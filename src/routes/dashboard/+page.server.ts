import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/dashboard');
  const rawTab = url.searchParams.get('tab');
  const tab = rawTab === 'discover' ? 'discover' : rawTab === 'lab' ? 'lab' : 'feed';

  const { data: follows } = await supabase.from('follows').select('expert_id').eq('follower_id', user.id);
  const followedIds = (follows ?? []).map((f) => f.expert_id);

  // feed: open ideas authored by experts the user follows
  let feed: any[] = [];
  if (followedIds.length) {
    const { data } = await supabase
      .from('ideas').select('id, slug, title, summary_md, type, status')
      .in('author_id', followedIds).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(50);
    feed = data ?? [];
  }

  // discover: approved experts (experts has two fks to profiles, so name the constraint) + followed flag
  const { data: rawExperts } = await supabase
    .from('experts').select('id, specialty, featured, profiles!experts_id_fkey(handle, display_name)')
    .eq('status', 'approved').order('featured', { ascending: false });
  const experts = (rawExperts ?? []).map((e: any) => ({
    id: e.id,
    specialty: e.specialty,
    featured: e.featured,
    profile: Array.isArray(e.profiles) ? (e.profiles[0] ?? null) : e.profiles,
    following: followedIds.includes(e.id)
  }));

  // my funding: my pledges joined to their idea (idea_funding has ONE fk to ideas, no hint needed)
  const { data: rawMine } = await supabase
    .from('idea_funding')
    .select('id, amount_cents, currency, status, idea_id, ideas(id, slug, title, status)')
    .eq('funder_id', user.id)
    .order('created_at', { ascending: false });
  const myPledges = (rawMine ?? []).map((p: any) => ({
    ...p,
    idea: Array.isArray(p.ideas) ? (p.ideas[0] ?? null) : p.ideas
  }));

  // chart: total committed/escrowed pledged per funded idea
  const byIdea = new Map<string, { label: string; value: number }>();
  for (const p of myPledges) {
    if (p.status !== 'committed' && p.status !== 'escrowed') continue;
    const key = p.idea_id;
    const label = p.idea?.title ?? 'Unknown idea';
    const cur = byIdea.get(key) ?? { label, value: 0 };
    cur.value += p.amount_cents;
    byIdea.set(key, cur);
  }
  const chart = [...byIdea.values()];
  const totalCommittedCents = chart.reduce((sum, c) => sum + c.value, 0);

  // Is the current user an approved expert? Approved experts publish straight to live;
  // everyone else submits into the admin review queue. Drives the publish-button copy.
  const { data: myExpert } = await supabase
    .from('experts').select('status').eq('id', user.id).maybeSingle();
  const isExpert = myExpert?.status === 'approved';

  // Lab tab: my drafts
  const { data: drafts } = await supabase
    .from('ideas').select('id, slug, title, summary_md, expansions, resolution_criteria_md, methodology_md, theory_of_change_md, extensions_md')
    .eq('author_id', user.id).eq('status', 'draft')
    .order('created_at', { ascending: false });

  // Payouts: my on-platform balances + Connect onboarding state (own rows via RLS).
  const { data: balances } = await supabase
    .from('account_balances')
    .select('available_cents, escrowed_cents, payable_cents')
    .eq('profile_id', user.id).maybeSingle();
  const { data: connect } = await supabase
    .from('stripe_connect_accounts')
    .select('payouts_enabled').eq('profile_id', user.id).maybeSingle();

  return {
    tab, hasFollows: followedIds.length > 0, feed, experts, myPledges, chart, totalCommittedCents,
    isExpert,
    drafts: drafts ?? [],
    balances: {
      availableCents: Number(balances?.available_cents ?? 0),
      escrowedCents: Number(balances?.escrowed_cents ?? 0),
      payableCents: Number(balances?.payable_cents ?? 0)
    },
    payoutsEnabled: connect?.payouts_enabled === true
  };
};

export const actions: Actions = {
  publish: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const fd = await request.formData();
    const id = String(fd.get('id'));
    if (!id) return fail(400, { message: 'Missing idea id' });
    const type = fd.get('type') === 'hypothesis' ? 'hypothesis' : 'open_ended';
    const claim = String(fd.get('claim') ?? '').trim();
    const summary_md = String(fd.get('summary_md') ?? '').trim();
    if (type === 'hypothesis' && !claim) return fail(400, { message: 'A hypothesis needs a claim' });
    if (!summary_md) return fail(400, { message: 'Add a short summary before publishing' });
    // Optional template sections - pass-through if the dialog provides them (nullable: empty → null)
    const resolution_criteria_md = String(fd.get('resolution_criteria_md') ?? '').trim() || null;
    const methodology_md = String(fd.get('methodology_md') ?? '').trim() || null;
    const theory_of_change_md = String(fd.get('theory_of_change_md') ?? '').trim() || null;
    const extensions_md = String(fd.get('extensions_md') ?? '').trim() || null;
    const patch = {
      type,
      claim: type === 'hypothesis' ? claim : null,
      summary_md,
      resolution_criteria_md,
      methodology_md,
      theory_of_change_md,
      extensions_md,
      status: 'open',
      published_at: new Date().toISOString()
    };
    const { data, error: e } = await supabase
      .from('ideas').update(patch).eq('id', id).eq('status', 'draft')
      .select('slug, status').single();
    if (e || !data) return fail(400, { message: e?.message ?? 'Publish failed' });
    if (data.status === 'open') redirect(303, `/ideas/${data.slug}`);
    return { submitted: true, id };
  },

  follow: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const { error: e } = await supabase.from('follows')
      .insert({ follower_id: user.id, expert_id: String(fd.get('expert_id')) });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
  unfollow: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'engage')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const { error: e } = await supabase.from('follows')
      .delete().eq('follower_id', user.id).eq('expert_id', String(fd.get('expert_id')));
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
  withdraw: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    if (!(await rateLimit(supabase, 'pledge')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    // RLS allows deleting only the caller's own still-committed pledge; .select() surfaces a no-op (someone
    // else's pledge, or an already-escrowed one) as a failure instead of a misleading success.
    const { data: del, error: e } = await supabase.from('idea_funding')
      .delete().eq('id', String(fd.get('pledge_id'))).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(409, { message: 'Pledge could not be withdrawn (already escrowed or not yours).' });
    return { ok: true };
  }
};
