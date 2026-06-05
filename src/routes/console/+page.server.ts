import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireExpert(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('experts').select('status').eq('id', userId).single();
  return data?.status === 'approved';
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/console');
  if (!(await requireExpert(supabase, user.id))) error(403, 'Approved experts only');

  const { data: ideas } = await supabase
    .from('ideas').select('id, title, type, status').eq('author_id', user.id)
    .order('created_at', { ascending: false });

  // answers awaiting a decision on MY ideas (ideas!inner — exactly one FK to ideas, so no hint needed; the
  // submitter embed names its constraint because answers has four FKs to profiles)
  const { data: rawQueue } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, idea_id,' +
        ' ideas!inner(id, title, type, author_id),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name),' +
        ' answer_artifacts(id, kind, url, label)'
    )
    .eq('ideas.author_id', user.id)
    .in('status', ['submitted', 'under_review', 'revision_requested'])
    .order('created_at', { ascending: true });

  // Normalise the to-one `submitter`/`ideas` embeds (supabase-js may return them as arrays); `(q: any)` matches
  // the Plan-2 embed precedent and keeps `npm run check` at 0 errors.
  const queue = (rawQueue ?? []).map((q: any) => ({
    ...q,
    submitter: Array.isArray(q.submitter) ? (q.submitter[0] ?? null) : q.submitter,
    ideas: Array.isArray(q.ideas) ? (q.ideas[0] ?? null) : q.ideas
  }));

  return { ideas: ideas ?? [], queue };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title required' });
    const type = fd.get('type') === 'hypothesis' ? 'hypothesis' : 'open_ended';
    const { data, error: e } = await supabase.from('ideas').insert({
      author_id: user.id, title, type,
      summary_md: String(fd.get('summary_md') ?? ''),
      claim: type === 'hypothesis' ? String(fd.get('claim') ?? '') : null,
      status: 'open', published_at: new Date().toISOString()
    }).select('id').single();
    if (e) return fail(400, { message: e.message });
    redirect(303, `/ideas/${data!.id}`);
  },

  start_review: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('start_review', { p_answer_id: String(fd.get('answer_id')) });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  verify: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const dollars = Number(fd.get('payout') ?? '');
    const payout = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null;
    const resolutionRaw = String(fd.get('resolution') ?? '');
    const resolution = ['yes', 'no', 'ambiguous'].includes(resolutionRaw) ? resolutionRaw : null;
    const { error: e } = await supabase.rpc('verify_answer', {
      p_answer_id: String(fd.get('answer_id')),
      p_note: String(fd.get('note') ?? '') || null,
      p_payout_amount_cents: payout,
      p_resolution: resolution
    } as any);
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  request_revision: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('request_revision_answer', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || null
    } as any);
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  reject: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('reject_answer', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || null
    } as any);
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
