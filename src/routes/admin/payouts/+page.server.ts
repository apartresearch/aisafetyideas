import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { notifyPayoutReleased } from '$lib/server/notify';

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/payouts');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');

  const { data: rawPending } = await supabase
    .from('answers')
    .select(
      'id, title, payout_amount_cents, payout_currency, verified_at, idea_id,' +
        ' ideas(id, slug, title),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('status', 'verified')
    .is('admin_approved_at', null)
    .is('admin_rejected_at', null)
    .order('verified_at', { ascending: true });

  // Normalise the to-one `submitter`/`ideas` embeds; `(p: any)` matches the Plan-2 embed precedent.
  const pending = (rawPending ?? []).map((p: any) => ({
    ...p,
    submitter: Array.isArray(p.submitter) ? (p.submitter[0] ?? null) : p.submitter,
    ideas: Array.isArray(p.ideas) ? (p.ideas[0] ?? null) : p.ideas
  }));

  return { pending };
};

export const actions: Actions = {
  approve: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    if (!(await rateLimit(supabase, 'admin')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const answerId = String(fd.get('answer_id'));
    // `undefined` (not null) for the optional note keeps full RPC param-name type-checking (see console route).
    const { error: e } = await supabase.rpc('admin_approve_payout', {
      p_answer_id: answerId, p_note: String(fd.get('note') ?? '') || undefined
    });
    if (e) return fail(400, { message: e.message });
    // Best-effort: fetch answer context for notification
    const { data: answerCtx } = await supabase
      .from('answers')
      .select('submitter_id, payout_amount_cents, ideas!inner(slug, title)')
      .eq('id', answerId)
      .single();
    if (answerCtx?.submitter_id) {
      const idea = Array.isArray(answerCtx.ideas) ? (answerCtx.ideas[0] ?? null) : answerCtx.ideas;
      if (idea) {
        await notifyPayoutReleased(answerCtx.submitter_id, {
          ideaTitle: idea.title,
          amountCents: answerCtx.payout_amount_cents ?? 0,
          url: `/ideas/${idea.slug}`
        });
      }
    }
    return { ok: true };
  },
  reject: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    if (!(await rateLimit(supabase, 'admin')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('admin_reject_payout', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || undefined
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
