import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { inferKind } from '$lib/artifacts';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { ideaParamColumn, isUuid, resolveIdeaId } from '$lib/server/ideas';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, `/login?next=/ideas/${params.slug}/answer`);
  const { data: idea } = await supabase
    .from('ideas').select('id, slug, title, type, status').eq(ideaParamColumn(params.slug), params.slug).single();
  if (!idea) error(404, 'Idea not found');
  // legacy /ideas/<uuid>/answer URL → canonical slug URL
  if (isUuid(params.slug)) redirect(301, `/ideas/${idea.slug}/answer`);
  if (idea.status !== 'open') error(400, 'This idea is not accepting answers');
  return { idea };
};

export const actions: Actions = {
  default: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to submit an answer' });
    if (!(await rateLimit(supabase, 'answer')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const explanation_md = String(fd.get('explanation_md') ?? '').trim();
    if (!title) return fail(400, { message: 'Title is required', title, explanation_md });
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });

    // RLS enforces submitter = self, status pinned, and idea must be open
    const { data: answer, error: e } = await supabase
      .from('answers')
      .insert({ idea_id: ideaId, submitter_id: user.id, title, explanation_md, status: 'submitted' })
      .select('id').single();
    if (e || !answer) return fail(400, { message: e?.message ?? 'Could not submit answer' });

    const urls = String(fd.get('artifacts') ?? '')
      .split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (urls.length) {
      const rows = urls.map((url) => ({ answer_id: answer.id, url, kind: inferKind(url) }));
      const { error: ae } = await supabase.from('answer_artifacts').insert(rows);
      if (ae) return fail(400, { message: `Answer saved, but artifacts failed: ${ae.message}` });
    }
    redirect(303, `/ideas/${params.slug}`);
  }
};
