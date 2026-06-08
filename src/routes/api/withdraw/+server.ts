import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { getPlatformConfig } from '$lib/server/config';
import { getStripe } from '$lib/server/stripe';

// Withdraw a payable balance to the caller's connected Stripe account.
// RESERVE-FIRST: request_withdrawal posts the payable→external ledger reservation (and is the
// authoritative gate). Only after it succeeds do we create the Stripe Transfer, keyed on the SAME
// idempotency key so a retried POST with the same nonce is a safe no-op end-to-end. The pre-checks
// below are a friendly fast-fail; the RPC re-validates everything server-side.
//
// Idempotency: key = 'wd:' + user.id + ':' + nonce. The client sends a fresh nonce per intended
// withdrawal; a retry with the same nonce re-runs the idempotent RPC (no double-reserve) and re-issues
// the same-keyed transfer (no double-pay).
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) return json({ message: 'Sign in' }, { status: 401 });
  if (!(await rateLimit(supabase, 'withdraw')).ok) return json({ message: RATE_LIMIT_MESSAGE }, { status: 429 });

  const cfg = await getPlatformConfig(supabase);
  if (!cfg.fundingEnabled) return json({ message: 'Payouts are not enabled' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const amountCents = Number(body.amount_cents);
  const nonce = typeof body.nonce === 'string' && body.nonce ? body.nonce : crypto.randomUUID();

  if (!Number.isFinite(amountCents) || amountCents < cfg.minWithdrawalCents) {
    return json({ message: `Minimum withdrawal is ${cfg.minWithdrawalCents} cents` }, { status: 400 });
  }

  const { data: bal } = await supabase
    .from('account_balances').select('payable_cents').eq('profile_id', user.id).maybeSingle();
  const payable = Number(bal?.payable_cents ?? 0);
  if (amountCents > payable) {
    return json({ message: 'Amount exceeds your payable balance' }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from('stripe_connect_accounts')
    .select('payouts_enabled, stripe_account_id').eq('profile_id', user.id).maybeSingle();
  if (!conn?.payouts_enabled || !conn?.stripe_account_id) {
    return json({ message: 'Complete payout onboarding first' }, { status: 409 });
  }

  const idempotencyKey = 'wd:' + user.id + ':' + nonce;

  // 1) Reserve in the ledger (authoritative gate). On error → 400 with the RPC message.
  const { error: rpcErr } = await supabase.rpc('request_withdrawal', {
    p_amount_cents: amountCents,
    p_idempotency_key: idempotencyKey
  });
  if (rpcErr) return json({ message: rpcErr.message }, { status: 400 });

  // 2) Create the transfer (same idempotency key). If this throws, the ledger reservation already
  // posted: we return 502 so the user knows support will reconcile. NOTE (Gate-0): test mode has no
  // automatic compensating reversal — production needs a reconciliation job that, on a confirmed
  // transfer failure, posts the reversing external→payable legs. Out of scope for this phase.
  try {
    await getStripe().transfers.create(
      { amount: amountCents, currency: 'usd', destination: conn.stripe_account_id },
      { idempotencyKey }
    );
  } catch (e) {
    console.error(`withdraw: ledger reserved but transfer failed key=${idempotencyKey}:`, e);
    return json(
      { message: 'Your withdrawal was reserved but the payout could not be sent. Support will reconcile this.' },
      { status: 502 }
    );
  }

  return json({ ok: true });
};
