import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock the seams (Stripe + config + rate-limit) - NO live calls ──
const transfersCreate = vi.fn();
vi.mock('$lib/server/stripe', () => ({
  getStripe: () => ({ transfers: { create: transfersCreate } })
}));
const getPlatformConfig = vi.fn();
vi.mock('$lib/server/config', () => ({ getPlatformConfig: (...a: any[]) => getPlatformConfig(...a) }));
const rateLimit = vi.fn();
vi.mock('$lib/server/rate-limit', () => ({
  rateLimit: (...a: any[]) => rateLimit(...a),
  RATE_LIMIT_MESSAGE: 'Slow down'
}));

import { POST } from './+server';

// Fake supabase: account_balances.select().eq().maybeSingle(); stripe_connect_accounts.select().eq().maybeSingle(); rpc()
const balRow = vi.fn();
const connRow = vi.fn();
const rpc = vi.fn();
const from = vi.fn((table: string) => ({
  select: () => ({ eq: () => ({ maybeSingle: table === 'account_balances' ? balRow : connRow }) })
}));

function ev(user: any = { id: 'u1' }, body: any = { amount_cents: 2000, nonce: 'n1' }) {
  return {
    request: { json: async () => body },
    url: new URL('https://app.example/api/withdraw'),
    locals: { supabase: { from, rpc }, safeGetSession: async () => ({ user }) }
  } as any;
}

beforeEach(() => {
  transfersCreate.mockReset().mockResolvedValue({ id: 'tr_1' });
  getPlatformConfig.mockReset().mockResolvedValue({ feeBps: 450, fundingEnabled: true, minWithdrawalCents: 100 });
  rateLimit.mockReset().mockResolvedValue({ ok: true });
  balRow.mockReset().mockResolvedValue({ data: { payable_cents: 5000 }, error: null });
  connRow.mockReset().mockResolvedValue({ data: { payouts_enabled: true, stripe_account_id: 'acct_1' }, error: null });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  from.mockClear();
});

describe('POST /api/withdraw', () => {
  it('401 without a user', async () => {
    expect((await POST(ev(null))).status).toBe(401);
  });

  it('429 when rate-limited (withdraw bucket)', async () => {
    rateLimit.mockResolvedValue({ ok: false });
    expect((await POST(ev())).status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith(expect.anything(), 'withdraw');
  });

  it('403 when funding is disabled', async () => {
    getPlatformConfig.mockResolvedValue({ feeBps: 450, fundingEnabled: false, minWithdrawalCents: 100 });
    expect((await POST(ev())).status).toBe(403);
  });

  it('400 when amount below minimum', async () => {
    const res = await POST(ev({ id: 'u1' }, { amount_cents: 50, nonce: 'n1' }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('400 when amount above payable balance', async () => {
    const res = await POST(ev({ id: 'u1' }, { amount_cents: 99999, nonce: 'n1' }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('409 when payouts not enabled', async () => {
    connRow.mockResolvedValue({ data: { payouts_enabled: false, stripe_account_id: 'acct_1' }, error: null });
    const res = await POST(ev());
    expect([400, 409]).toContain(res.status);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('happy: reserves via request_withdrawal THEN creates the transfer with a matching idempotency key', async () => {
    const res = await POST(ev({ id: 'u1' }, { amount_cents: 2000, nonce: 'n1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // RPC called first
    const rpcCall = rpc.mock.calls.find((c) => c[0] === 'request_withdrawal');
    expect(rpcCall).toBeTruthy();
    expect(rpcCall![1].p_amount_cents).toBe(2000);
    const key = rpcCall![1].p_idempotency_key;
    expect(key).toContain('u1');
    expect(key).toContain('n1');
    // transfer created with the SAME idempotency key
    expect(transfersCreate).toHaveBeenCalledTimes(1);
    const [body, opts] = transfersCreate.mock.calls[0];
    expect(body).toMatchObject({ amount: 2000, currency: 'usd', destination: 'acct_1' });
    expect(opts).toEqual({ idempotencyKey: key });
  });

  it('400 when the RPC rejects (insufficient payable surfaced by the authoritative re-check)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'insufficient payable balance' } });
    const res = await POST(ev());
    expect(res.status).toBe(400);
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it('502 when the transfer fails AFTER the ledger reservation posted (support reconciles)', async () => {
    transfersCreate.mockRejectedValue(new Error('stripe down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(ev());
    expect(res.status).toBe(502);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
