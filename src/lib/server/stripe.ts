import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

// Mockable seam (cf. $lib/server/ai.ts): lazily construct the Stripe client so importing this
// module never throws and tests can mock it wholesale. NO live calls in CI - always mocked.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
  if (!_stripe) _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}

export function getStripeWebhookSecret(): string {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook secret not configured');
  return env.STRIPE_WEBHOOK_SECRET;
}
