import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { renderMarkdown } from '$lib/server/markdown';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { ideaParamColumn, isUuid, resolveIdeaId } from '$lib/server/ideas';
import { getPlatformConfig } from '$lib/server/config';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  // Core columns are guaranteed to exist (the same set the public list query reads), so existence
  // and the 404 decision never depend on a column a drifted DB might be missing.
  const CORE = 'id, slug, title, summary_md, type, status, author_id';
  // Extended columns enrich the page but must NOT be able to 404 it: if the DB is missing any of
  // them (schema drift between the migrations and a rebuilt prod DB), the rich select errors and we
  // fall back to the core columns so a real idea still renders rather than masquerading as 404.
  const EXTENDED =
    `${CORE}, claim, resolution, estimated_hours, importance, source_url, currency,` +
    ' resolution_criteria_md, methodology_md, theory_of_change_md, extensions_md';
  const col = ideaParamColumn(params.slug);
  let idea: Record<string, any> | null = null;
  {
    const full = await supabase.from('ideas').select(EXTENDED).eq(col, params.slug).single();
    if (full.data) {
      idea = full.data as Record<string, any>;
    } else {
      if (full.error) console.error('idea detail: extended select failed, falling back to core', full.error.message);
      const core = await supabase.from('ideas').select(CORE).eq(col, params.slug).single();
      idea = (core.data as Record<string, any>) ?? null;
    }
  }
  if (!idea) error(404, 'Idea not found');

  // Determine admin status early — needed for the draft/archived gate below.
  let isAdminEarly = false;
  if (user) {
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    isAdminEarly = me?.is_admin === true;
  }

  // Draft/archived ideas are only visible to their author or an admin.
  if (idea.status === 'archived' || idea.status === 'draft') {
    const isAuthor = !!user && user.id === idea.author_id;
    if (!isAuthor && !isAdminEarly) error(404, 'Idea not found');
  }

  // legacy /ideas/<uuid> URL → permanent-redirect to the canonical slug URL
  if (isUuid(params.slug)) redirect(301, `/ideas/${idea.slug}`);

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
  // isAdminEarly was already fetched above; reuse it here (avoids a second profile fetch)
  let isAdmin = isAdminEarly;
  if (user) {
    const { data: mine } = await supabase
      .from('interest').select('id').eq('idea_id', idea.id).eq('profile_id', user.id).maybeSingle();
    myInterestId = mine?.id ?? null;
  }

  // platform funding flag — drives the Stripe Checkout path vs. the legacy pledge form
  const { fundingEnabled } = await getPlatformConfig(supabase);

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
    resolution_criteria_html: idea.resolution_criteria_md ? renderMarkdown(idea.resolution_criteria_md) : '',
    methodology_html: idea.methodology_md ? renderMarkdown(idea.methodology_md) : '',
    theory_of_change_html: idea.theory_of_change_md ? renderMarkdown(idea.theory_of_change_md) : '',
    extensions_html: idea.extensions_md ? renderMarkdown(idea.extensions_md) : '',
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
    fundingEnabled,
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
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });
    const { error: e } = await supabase.from('idea_funding').insert({
      idea_id: ideaId, funder_id: user.id, amount_cents: Math.round(dollars * 100), status: 'committed'
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
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });
    // RLS enforces author = self + visible idea + legacy pinned
    const { error: e } = await supabase.from('comments').insert({
      idea_id: ideaId, author_id: user.id, body_md
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
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });
    const { error: e } = await supabase.from('interest').insert({
      idea_id: ideaId, profile_id: user.id, note_md
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
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });
    // switch = delete own row first (no UPDATE policy), then insert; a 23505 race means a vote
    // already landed — treat as ok (the page re-load shows the truth)
    const { error: delErr } = await supabase.from('idea_votes')
      .delete().eq('idea_id', ideaId).eq('profile_id', user.id);
    if (delErr) return fail(400, { message: delErr.message });
    const { error: e } = await supabase.from('idea_votes').insert({
      idea_id: ideaId, profile_id: user.id, value
    });
    if (e && (e as { code?: string }).code !== '23505') return fail(400, { message: e.message });
    return { ok: true };
  },

  unvote: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });
    const { error: e } = await supabase.from('idea_votes')
      .delete().eq('idea_id', ideaId).eq('profile_id', user.id);
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  uninterest: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const ideaId = await resolveIdeaId(supabase, params.slug);
    if (!ideaId) return fail(404, { message: 'Idea not found' });
    const { data: del, error: e } = await supabase.from('interest')
      .delete().eq('idea_id', ideaId).eq('profile_id', user.id).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(409, { message: 'You were not marked interested' });
    return { ok: true };
  }
};
