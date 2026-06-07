import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { renderMarkdown } from '$lib/server/markdown';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id, currency')
    .eq('id', params.id)
    .single();
  if (!idea) error(404, 'Idea not found');

  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };

  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);

  const { data: rawAnswers } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, submitter_id,' +
        ' answer_artifacts(id, kind, url, label),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });
  const answers = (rawAnswers ?? []).map((a: any) => ({
    id: a.id, title: a.title, status: a.status, payout_amount_cents: a.payout_amount_cents,
    answer_artifacts: a.answer_artifacts,
    explanation_html: renderMarkdown(a.explanation_md),   // field-picked: don't ship raw explanation_md to the client
    submitter: Array.isArray(a.submitter) ? (a.submitter[0] ?? null) : a.submitter
  }));

  const { data: pot } = await supabase
    .from('bounty_pot').select('pot_cents, funder_count').eq('idea_id', idea.id).maybeSingle();
  const { data: rawFunders } = await supabase
    .from('idea_funding')
    .select('amount_cents, currency, funder_id, funder:profiles(handle, display_name)')
    .eq('idea_id', idea.id).in('status', ['committed', 'escrowed'])
    .order('created_at', { ascending: false });
  const funderMap = new Map<string, { key: string; name: string; amount_cents: number; currency: string }>();
  for (const f of (rawFunders ?? []) as any[]) {
    const prof = Array.isArray(f.funder) ? (f.funder[0] ?? null) : f.funder;
    const key = f.funder_id ?? 'anon';
    const cur = funderMap.get(key) ?? {
      key, name: prof?.display_name ?? prof?.handle ?? 'Anonymous', amount_cents: 0, currency: f.currency ?? 'USD'
    };
    cur.amount_cents += f.amount_cents;
    funderMap.set(key, cur);
  }
  const funders = [...funderMap.values()];

  // comments (flat, oldest first) with sanitized bodies
  const { data: rawComments } = await supabase
    .from('comments')
    .select('id, body_md, author_id, created_at, author:profiles(handle, display_name)')
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });
  const comments = (rawComments ?? []).map((c: any) => ({
    id: c.id,
    author_id: c.author_id,
    author: Array.isArray(c.author) ? (c.author[0] ?? null) : c.author,
    body_html: renderMarkdown(c.body_md)
  }));

  // interest: total + whether the current user is interested
  const { count: interestCount } = await supabase
    .from('interest').select('id', { count: 'exact', head: true }).eq('idea_id', idea.id);
  let myInterestId: string | null = null;
  let isAdmin = false;
  if (user) {
    const { data: mine } = await supabase
      .from('interest').select('id').eq('idea_id', idea.id).eq('profile_id', user.id).maybeSingle();
    myInterestId = mine?.id ?? null;
    // real admin status (from the DB, never user_metadata) so an admin sees the moderation delete control
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    isAdmin = me?.is_admin === true;
  }

  // votes: totals + the caller's own vote
  const { data: voteTotals } = await supabase
    .from('idea_vote_totals').select('score').eq('idea_id', idea.id).maybeSingle();
  let myVote: 1 | -1 | null = null;
  if (user) {
    const { data: mv } = await supabase
      .from('idea_votes').select('value').eq('idea_id', idea.id).eq('profile_id', user.id).maybeSingle();
    myVote = (mv?.value as 1 | -1 | undefined) ?? null;
  }

  return {
    idea,
    summary_html: renderMarkdown(idea.summary_md),
    author,
    categories: (cats ?? []).map((c: any) => c.categories),
    answers,
    pot: { pot_cents: pot?.pot_cents ?? 0, funder_count: pot?.funder_count ?? 0 },
    funders,
    comments,
    interestCount: interestCount ?? 0,
    score: voteTotals?.score ?? 0,
    myVote,
    myInterestId,
    isAdmin,
    userId: user?.id ?? null,
    canSubmit: !!user && idea.status === 'open',
    canFund: !!user && idea.status === 'open',
    canEngage: !!user
  };
};

export const actions: Actions = {
  pledge: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to fund this idea' });
    if (!(await rateLimit(supabase, 'pledge')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const dollars = Number(fd.get('amount') ?? '');
    if (!Number.isFinite(dollars) || dollars <= 0) return fail(400, { message: 'Enter an amount greater than 0' });
    const { error: e } = await supabase.from('idea_funding').insert({
      idea_id: params.id, funder_id: user.id, amount_cents: Math.round(dollars * 100), status: 'committed'
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  comment: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to comment' });
    if (!(await rateLimit(supabase, 'comment')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const body_md = String(fd.get('body_md') ?? '').trim();
    if (!body_md) return fail(400, { message: 'Write something first' });
    if (body_md.length > 10000) return fail(400, { message: 'Comment is too long (max 10,000 characters)' });
    // RLS enforces author = self + visible idea + legacy pinned
    const { error: e } = await supabase.from('comments').insert({
      idea_id: params.id, author_id: user.id, body_md
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  delete_comment: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'comment_delete')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    // RLS allows deleting only your own comment (or admin); .select() surfaces a no-op
    const { data: del, error: e } = await supabase.from('comments')
      .delete().eq('id', String(fd.get('comment_id'))).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(403, { message: 'Not allowed to delete that comment' });
    return { ok: true };
  },

  interest: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to express interest' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const note_md = String(fd.get('note_md') ?? '').trim().slice(0, 2000) || null;
    const { error: e } = await supabase.from('interest').insert({
      idea_id: params.id, profile_id: user.id, note_md
    });
    if (e) {
      // a duplicate (double-click / stale tab) means "already interested" — idempotent, don't leak the constraint name
      if ((e as { code?: string }).code === '23505') return { ok: true };
      return fail(400, { message: e.message });
    }
    return { ok: true };
  },

  vote: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to vote' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const value = Number(fd.get('value'));
    if (value !== 1 && value !== -1) return fail(400, { message: 'Invalid vote' });
    // switch = delete own row first (no UPDATE policy), then insert; a 23505 race means a vote
    // already landed — treat as ok (the page re-load shows the truth)
    const { error: delErr } = await supabase.from('idea_votes')
      .delete().eq('idea_id', params.id).eq('profile_id', user.id);
    if (delErr) return fail(400, { message: delErr.message });
    const { error: e } = await supabase.from('idea_votes').insert({
      idea_id: params.id, profile_id: user.id, value
    });
    if (e && (e as { code?: string }).code !== '23505') return fail(400, { message: e.message });
    return { ok: true };
  },

  unvote: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const { error: e } = await supabase.from('idea_votes')
      .delete().eq('idea_id', params.id).eq('profile_id', user.id);
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  uninterest: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const { data: del, error: e } = await supabase.from('interest')
      .delete().eq('idea_id', params.id).eq('profile_id', user.id).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(409, { message: 'You were not marked interested' });
    return { ok: true };
  }
};
