import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
import { getPlatformConfig } from '$lib/server/config';
import { getStripe } from '$lib/server/stripe';

// Create a Stripe Checkout session for a donation. The donor pays Stripe directly; the credit
// to their on-platform balance (and any per-idea escrow) happens later in the webhook - never here.
export const POST: RequestHandler = async ({ request, url, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) return json({ message: 'Sign in' }, { status: 401 });
  if (!(await rateLimit(supabase, 'donate')).ok) return json({ message: RATE_LIMIT_MESSAGE }, { status: 429 });

  const cfg = await getPlatformConfig(supabase);
  if (!cfg.fundingEnabled) return json({ message: 'Funding is not enabled' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const ideaId = typeof body.idea_id === 'string' && body.idea_id ? body.idea_id : undefined;
  const amountCents = Number(body.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    return json({ message: 'Enter an amount of at least $1' }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: ideaId ? 'Fund a research idea' : 'Add funds' }
        },
        quantity: 1
      }
    ],
    metadata: { profile_id: user.id, idea_id: ideaId ?? '', kind: 'donation' },
    success_url: url.origin + '/dashboard?funded=1',
    cancel_url: url.origin + (ideaId ? '/ideas' : '/dashboard')
  });

  return json({ url: session.url });
};
