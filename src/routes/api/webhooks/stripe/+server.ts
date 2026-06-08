import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe, getStripeWebhookSecret } from '$lib/server/stripe';
import { getSystemClient } from '$lib/server/system-client';
import { getPlatformConfig } from '$lib/server/config';
import { splitFee } from '$lib/fee';

// Stripe webhook. Authenticates as the dedicated system user (is_admin) to call the admin-only
// money RPCs — NO service-role client. Dedupes on event.id; replays short-circuit to a fast 200.
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig!, getStripeWebhookSecret());
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  const sys = await getSystemClient();

  // Dedupe: if we've already fully processed this event, do nothing (a fast 200 so Stripe stops
  // retrying). We record the event AFTER processing — the money RPCs are idempotent on event.id,
  // so a retry after a mid-process failure safely re-runs them (no double-credit) instead of
  // losing a credit to a prematurely-recorded event.
  const { data: existing } = await sys.from('stripe_events').select('id').eq('id', event.id).maybeSingle();
  if (existing) return json({ received: true });

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as any;
    const meta = s.metadata ?? {};
    const amount = s.amount_total as number;

    // credit_balance credits the donor NET of the platform fee. So we must escrow the NET, not
    // the gross — otherwise escrow would exceed the donor's available balance and fail.
    await sys.rpc('credit_balance', {
      p_profile: meta.profile_id,
      p_amount_cents: amount,
      p_idempotency_key: event.id,
      p_source: 'stripe'
    });

    if (meta.idea_id) {
      const cfg = await getPlatformConfig(sys);
      const { netCents } = splitFee(amount, cfg.feeBps);
      if (netCents > 0) {
        await sys.rpc('admin_escrow_for', {
          p_funder: meta.profile_id,
          p_idea: meta.idea_id,
          p_amount_cents: netCents,
          p_idempotency_key: event.id + ':escrow'
        });
      }
    }
  }

  // Record only after successful processing (see dedupe note above).
  await sys.from('stripe_events').insert({ id: event.id, type: event.type });

  return json({ received: true });
};
