import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock the seams (Stripe + system client + config) - NO live calls ──
const constructEvent = vi.fn();
vi.mock('$lib/server/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
  getStripeWebhookSecret: () => 'whsec_test'
}));

// Fake system client: from().select().eq().maybeSingle() + insert() + rpc() are spies.
const maybeSingle = vi.fn();
const insert = vi.fn().mockResolvedValue({ error: null });
const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
const updateEq = vi.fn().mockResolvedValue({ error: null });
const update = vi.fn(() => ({ eq: updateEq }));
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
  insert,
  update
}));
const sysClient: any = {
  from,
  rpc,
  // getPlatformConfig(sys) reads platform_config via .from().select().eq().single()
  // we route that through the same `from` mock below by special-casing the table name.
};
vi.mock('$lib/server/system-client', () => ({ getSystemClient: async () => sysClient }));

// config reads via getPlatformConfig(sys) - mock it directly so we don't fight the from() mock.
vi.mock('$lib/server/config', () => ({
  getPlatformConfig: async () => ({ feeBps: 450, fundingEnabled: true, minWithdrawalCents: 100 })
}));

import { POST } from './+server';

function req(sig = 'good-sig', body = 'raw') {
  return {
    request: {
      text: async () => body,
      headers: { get: (k: string) => (k === 'stripe-signature' ? sig : null) }
    }
  } as any;
}

const completedEvent = {
  id: 'evt_123',
  type: 'checkout.session.completed',
  data: { object: { amount_total: 10000, metadata: { profile_id: 'u1', idea_id: '', kind: 'donation' } } }
};

beforeEach(() => {
  constructEvent.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  insert.mockClear();
  rpc.mockClear();
  update.mockClear();
  updateEq.mockClear();
  from.mockClear();
});

describe('POST /api/webhooks/stripe', () => {
  it('400 on a bad signature (no system client / RPC touched)', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad'); });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('valid event: inserts stripe_events + calls credit_balance keyed on event.id', async () => {
    constructEvent.mockReturnValue(completedEvent);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({ id: 'evt_123', type: 'checkout.session.completed' });
    const creditCall = rpc.mock.calls.find((c) => c[0] === 'credit_balance');
    expect(creditCall).toBeTruthy();
    expect(creditCall![1]).toMatchObject({ p_profile: 'u1', p_amount_cents: 10000, p_idempotency_key: 'evt_123', p_source: 'stripe' });
  });

  it('with idea_id: also escrows the NET (gross 10000 @ 450 bps → 9550) on behalf of the donor', async () => {
    constructEvent.mockReturnValue({
      ...completedEvent,
      data: { object: { amount_total: 10000, metadata: { profile_id: 'u1', idea_id: 'idea-9', kind: 'donation' } } }
    });
    await POST(req());
    const escrowCall = rpc.mock.calls.find((c) => c[0] === 'admin_escrow_for');
    expect(escrowCall).toBeTruthy();
    expect(escrowCall![1]).toMatchObject({ p_funder: 'u1', p_idea: 'idea-9', p_amount_cents: 9550, p_idempotency_key: 'evt_123:escrow' });
  });

  it('account.updated: flips payouts_enabled on the connect row keyed by stripe_account_id', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_acct',
      type: 'account.updated',
      data: { object: { id: 'acct_X', payouts_enabled: true } }
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ payouts_enabled: true, onboarding_status: 'enabled' })
    );
    expect(updateEq).toHaveBeenCalledWith('stripe_account_id', 'acct_X');
    expect(insert).toHaveBeenCalledWith({ id: 'evt_acct', type: 'account.updated' });
  });

  it('replay: a known event short-circuits - no credit_balance, fast 200', async () => {
    constructEvent.mockReturnValue(completedEvent);
    maybeSingle.mockResolvedValue({ data: { id: 'evt_123' }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
