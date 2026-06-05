import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

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
    ...a,
    submitter: Array.isArray(a.submitter) ? (a.submitter[0] ?? null) : a.submitter
  }));

  // funding: pot (view) + the active funder list (idea_funding has ONE fk to profiles, so no embed hint needed)
  const { data: pot } = await supabase
    .from('bounty_pot').select('pot_cents, funder_count').eq('idea_id', idea.id).maybeSingle();
  const { data: rawFunders } = await supabase
    .from('idea_funding')
    .select('amount_cents, currency, funder_id, funder:profiles(handle, display_name)')
    .eq('idea_id', idea.id)
    .in('status', ['committed', 'escrowed'])
    .order('created_at', { ascending: false });
  // Aggregate by funder so top-ups collapse to one row (and the list agrees with bounty_pot.funder_count);
  // null funder_id (deleted account) buckets as a single 'anon' row, matching the view's coalesce(...,'anon').
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

  return {
    idea,
    author,
    categories: (cats ?? []).map((c: any) => c.categories),
    answers,
    // bounty_pot is a VIEW → every column is typed `number | null`; coalesce the INNER values (the outer `?? {…}`
    // only covers the no-row case) so BountyMeter's `number` props type-check.
    pot: { pot_cents: pot?.pot_cents ?? 0, funder_count: pot?.funder_count ?? 0 },
    funders,
    canSubmit: !!user && idea.status === 'open',
    canFund: !!user && idea.status === 'open'
  };
};

export const actions: Actions = {
  pledge: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to fund this idea' });
    const fd = await request.formData();
    const dollars = Number(fd.get('amount') ?? '');
    if (!Number.isFinite(dollars) || dollars <= 0) return fail(400, { message: 'Enter an amount greater than 0' });
    // RLS enforces funder = self, status pinned 'committed', and the idea must be open
    const { error: e } = await supabase.from('idea_funding').insert({
      idea_id: params.id, funder_id: user.id, amount_cents: Math.round(dollars * 100), status: 'committed'
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
