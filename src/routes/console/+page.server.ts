import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { renderMarkdown } from '$lib/server/markdown';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { notifyDecision, notifyQueueItem } from '$lib/server/notify';

async function requireExpert(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('experts').select('status').eq('id', userId).single();
  return data?.status === 'approved';
}

// Fetch submitter_id + idea info for a given answer (for notifications)
async function answerNotifyContext(
  supabase: any,
  answerId: string
): Promise<{ submitterId: string; ideaTitle: string; answerTitle: string; ideaSlug: string } | null> {
  const { data } = await supabase
    .from('answers')
    .select('title, submitter_id, ideas!inner(slug, title)')
    .eq('id', answerId)
    .single();
  if (!data) return null;
  const idea = Array.isArray(data.ideas) ? (data.ideas[0] ?? null) : data.ideas;
  if (!idea) return null;
  return {
    submitterId: data.submitter_id,
    ideaTitle: idea.title,
    answerTitle: data.title,
    ideaSlug: idea.slug
  };
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/console');
  if (!(await requireExpert(supabase, user.id))) error(403, 'Approved experts only');

  const { data: ideas } = await supabase
    .from('ideas').select('id, slug, title, type, status').eq('author_id', user.id)
    .order('created_at', { ascending: false });

  // answers awaiting a decision on MY ideas (ideas!inner - exactly one FK to ideas, so no hint needed; the
  // submitter embed names its constraint because answers has four FKs to profiles)
  const { data: rawQueue } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, idea_id,' +
        ' ideas!inner(id, slug, title, type, author_id),' +
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
    ideas: Array.isArray(q.ideas) ? (q.ideas[0] ?? null) : q.ideas,
    explanation_html: renderMarkdown(q.explanation_md)
  }));

  return { ideas: ideas ?? [], queue };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    if (!(await rateLimit(supabase, 'idea_create')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title required' });
    const type = fd.get('type') === 'hypothesis' ? 'hypothesis' : 'open_ended';
    const resolutionCriteria = String(fd.get('resolution_criteria_md') ?? '').trim() || null;
    const methodology = String(fd.get('methodology_md') ?? '').trim() || null;
    const theoryOfChange = String(fd.get('theory_of_change_md') ?? '').trim() || null;
    const extensions = String(fd.get('extensions_md') ?? '').trim() || null;
    const { data, error: e } = await supabase.from('ideas').insert({
      author_id: user.id, title, type,
      summary_md: String(fd.get('summary_md') ?? ''),
      claim: type === 'hypothesis' ? String(fd.get('claim') ?? '') : null,
      resolution_criteria_md: resolutionCriteria,
      methodology_md: methodology,
      theory_of_change_md: theoryOfChange,
      extensions_md: extensions,
      status: 'open', published_at: new Date().toISOString()
    }).select('slug').single();   // slug is assigned by the ideas_set_slug trigger
    if (e) return fail(400, { message: e.message });
    redirect(303, `/ideas/${data!.slug}`);
  },

  start_review: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    if (!(await rateLimit(supabase, 'review')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('start_review', { p_answer_id: String(fd.get('answer_id')) });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  verify: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    if (!(await rateLimit(supabase, 'review')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const dollars = Number(fd.get('payout') ?? '');
    // Pass `undefined` (not null) for omitted optional RPC params: supabase-js types defaulted params as
    // optional (`p_note?: string`), drops undefined keys from the request, and the SQL `default null` yields
    // the same NULL - while keeping full compile-time checking of the RPC name and param names.
    const payout = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : undefined;
    const resolutionRaw = String(fd.get('resolution') ?? '');
    const resolution = ['yes', 'no', 'ambiguous'].includes(resolutionRaw) ? resolutionRaw : undefined;
    const answerId = String(fd.get('answer_id'));
    const { error: e } = await supabase.rpc('verify_answer', {
      p_answer_id: answerId,
      p_note: String(fd.get('note') ?? '') || undefined,
      p_payout_amount_cents: payout,
      p_resolution: resolution
    });
    if (e) return fail(400, { message: e.message });
    // Best-effort notifications (swallow errors internally)
    const ctx = await answerNotifyContext(supabase, answerId).catch(() => null);
    if (ctx) {
      const noteText = String(fd.get('note') ?? '') || undefined;
      const url = `/ideas/${ctx.ideaSlug}`;
      await notifyDecision(ctx.submitterId, { ideaTitle: ctx.ideaTitle, decision: 'verified', note: noteText, url });
      await notifyQueueItem({ ideaTitle: ctx.ideaTitle, answerTitle: ctx.answerTitle, url });
    }
    return { ok: true };
  },

  request_revision: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    if (!(await rateLimit(supabase, 'review')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const answerId = String(fd.get('answer_id'));
    const { error: e } = await supabase.rpc('request_revision_answer', {
      p_answer_id: answerId, p_note: String(fd.get('note') ?? '') || undefined
    });
    if (e) return fail(400, { message: e.message });
    const ctx = await answerNotifyContext(supabase, answerId).catch(() => null);
    if (ctx) {
      const noteText = String(fd.get('note') ?? '') || undefined;
      await notifyDecision(ctx.submitterId, { ideaTitle: ctx.ideaTitle, decision: 'revision_requested', note: noteText, url: `/ideas/${ctx.ideaSlug}` });
    }
    return { ok: true };
  },

  reject: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    if (!(await rateLimit(supabase, 'review')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const answerId = String(fd.get('answer_id'));
    const { error: e } = await supabase.rpc('reject_answer', {
      p_answer_id: answerId, p_note: String(fd.get('note') ?? '') || undefined
    });
    if (e) return fail(400, { message: e.message });
    const ctx = await answerNotifyContext(supabase, answerId).catch(() => null);
    if (ctx) {
      const noteText = String(fd.get('note') ?? '') || undefined;
      await notifyDecision(ctx.submitterId, { ideaTitle: ctx.ideaTitle, decision: 'rejected', note: noteText, url: `/ideas/${ctx.ideaSlug}` });
    }
    return { ok: true };
  }
};
