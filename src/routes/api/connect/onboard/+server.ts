import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { getStripe } from '$lib/server/stripe';

// Start (or resume) Stripe Connect Express onboarding so a submitter can receive payouts.
// We create the Express account once and store the mapping via the caller's own client
// (own-row INSERT allowed by RLS; payouts_enabled stays false until the account.updated webhook
// flips it). Then we mint a fresh account link and hand its url to the client to redirect to.
export const POST: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) return json({ message: 'Sign in' }, { status: 401 });
  if (!(await rateLimit(supabase, 'kyc')).ok) return json({ message: RATE_LIMIT_MESSAGE }, { status: 429 });

  const { data: existing } = await supabase
    .from('stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  let accountId = existing?.stripe_account_id as string | undefined;
  if (!accountId) {
    const acct = await getStripe().accounts.create({ type: 'express', metadata: { profile_id: user.id } });
    accountId = acct.id;
    // Own-row upsert (RLS: profile_id = auth.uid() and payouts_enabled = false).
    await supabase.from('stripe_connect_accounts').upsert(
      { profile_id: user.id, stripe_account_id: accountId, onboarding_status: 'pending', payouts_enabled: false },
      { onConflict: 'profile_id' }
    );
  }

  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: url.origin + '/dashboard?connect=refresh',
    return_url: url.origin + '/dashboard?connect=done'
  });

  return json({ url: link.url });
};
