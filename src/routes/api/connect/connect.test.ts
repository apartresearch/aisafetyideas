import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock the seams (Stripe + rate-limit) — NO live calls ──
const accountsCreate = vi.fn();
const accountLinksCreate = vi.fn();
vi.mock('$lib/server/stripe', () => ({
  getStripe: () => ({
    accounts: { create: accountsCreate },
    accountLinks: { create: accountLinksCreate }
  })
}));
const rateLimit = vi.fn();
vi.mock('$lib/server/rate-limit', () => ({
  rateLimit: (...a: any[]) => rateLimit(...a),
  RATE_LIMIT_MESSAGE: 'Slow down'
}));

import { POST } from './onboard/+server';

// Fake supabase: from('stripe_connect_accounts').select().eq().maybeSingle() + upsert()
const maybeSingle = vi.fn();
const upsert = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
  upsert
}));

function ev(user: any = { id: 'u1' }) {
  return {
    request: {},
    url: new URL('https://app.example/api/connect/onboard'),
    locals: { supabase: { from }, safeGetSession: async () => ({ user }) }
  } as any;
}

beforeEach(() => {
  accountsCreate.mockReset().mockResolvedValue({ id: 'acct_new' });
  accountLinksCreate.mockReset().mockResolvedValue({ url: 'https://connect.stripe.test/onboard/x' });
  rateLimit.mockReset().mockResolvedValue({ ok: true });
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  upsert.mockClear();
  from.mockClear();
});

describe('POST /api/connect/onboard', () => {
  it('401 without a user', async () => {
    expect((await POST(ev(null))).status).toBe(401);
  });

  it('429 when rate-limited (kyc bucket)', async () => {
    rateLimit.mockResolvedValue({ ok: false });
    expect((await POST(ev())).status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith(expect.anything(), 'kyc');
  });

  it('happy (no existing row): creates an Express account + upserts the row + returns an account link url', async () => {
    const res = await POST(ev({ id: 'u1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://connect.stripe.test/onboard/x' });
    expect(accountsCreate).toHaveBeenCalledTimes(1);
    expect(accountsCreate.mock.calls[0][0]).toMatchObject({ type: 'express', metadata: { profile_id: 'u1' } });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'u1', stripe_account_id: 'acct_new', payouts_enabled: false }),
      expect.anything()
    );
    const linkArg = accountLinksCreate.mock.calls[0][0];
    expect(linkArg.account).toBe('acct_new');
    expect(linkArg.type).toBe('account_onboarding');
    expect(linkArg.return_url).toContain('connect=done');
    expect(linkArg.refresh_url).toContain('connect=refresh');
  });

  it('reuses an existing account id (no new account created)', async () => {
    maybeSingle.mockResolvedValue({ data: { stripe_account_id: 'acct_existing' }, error: null });
    const res = await POST(ev({ id: 'u1' }));
    expect(res.status).toBe(200);
    expect(accountsCreate).not.toHaveBeenCalled();
    expect(accountLinksCreate.mock.calls[0][0].account).toBe('acct_existing');
  });
});
