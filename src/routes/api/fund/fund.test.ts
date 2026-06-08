import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock the seams (Stripe + config + rate-limit) — NO live calls ──
const sessionsCreate = vi.fn();
vi.mock('$lib/server/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } })
}));
const getPlatformConfig = vi.fn();
vi.mock('$lib/server/config', () => ({ getPlatformConfig: (...a: any[]) => getPlatformConfig(...a) }));
const rateLimit = vi.fn();
vi.mock('$lib/server/rate-limit', () => ({
  rateLimit: (...a: any[]) => rateLimit(...a),
  RATE_LIMIT_MESSAGE: 'Slow down'
}));

import { POST } from './+server';

function ev(user: any = { id: 'u1' }, body: any = { amount_cents: 5000 }) {
  return {
    request: { json: async () => body },
    url: new URL('https://app.example/api/fund'),
    locals: { supabase: {}, safeGetSession: async () => ({ user }) }
  } as any;
}

beforeEach(() => {
  sessionsCreate.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/c/sess_1' });
  getPlatformConfig.mockReset().mockResolvedValue({ feeBps: 450, fundingEnabled: true, minWithdrawalCents: 100 });
  rateLimit.mockReset().mockResolvedValue({ ok: true });
});

describe('POST /api/fund', () => {
  it('401 without a user', async () => {
    expect((await POST(ev(null))).status).toBe(401);
  });

  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false });
    expect((await POST(ev())).status).toBe(429);
  });

  it('403 when funding is disabled', async () => {
    getPlatformConfig.mockResolvedValue({ feeBps: 450, fundingEnabled: false, minWithdrawalCents: 100 });
    expect((await POST(ev())).status).toBe(403);
  });

  it('400 when amount_cents < 100 ($1 minimum)', async () => {
    expect((await POST(ev({ id: 'u1' }, { amount_cents: 99 }))).status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('happy: creates a Checkout session with the right metadata + returns { url }', async () => {
    const res = await POST(ev({ id: 'u1' }, { amount_cents: 5000, idea_id: 'idea-9' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/c/sess_1' });
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe('payment');
    expect(arg.line_items[0].price_data.unit_amount).toBe(5000);
    expect(arg.metadata).toEqual({ profile_id: 'u1', idea_id: 'idea-9', kind: 'donation' });
    expect(arg.success_url).toBe('https://app.example/dashboard?funded=1');
  });

  it('add-funds (no idea_id): metadata idea_id is empty, cancel_url → /dashboard', async () => {
    await POST(ev({ id: 'u1' }, { amount_cents: 2500 }));
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.metadata.idea_id).toBe('');
    expect(arg.cancel_url).toBe('https://app.example/dashboard');
  });
});
