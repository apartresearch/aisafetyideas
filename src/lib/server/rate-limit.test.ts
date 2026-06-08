import { describe, it, expect, vi } from 'vitest';
import { BUCKETS, rateLimit, loginLimited, __resetLoginLimiter } from './rate-limit';

const mkSupabase = (rpc: (...a: any[]) => any) => ({ rpc }) as any;

describe('rateLimit (DB-backed, fail-open)', () => {
  it('passes ONLY the bucket name to the RPC (limits are server-authoritative) and allows on true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const res = await rateLimit(mkSupabase(rpc), 'comment');
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', { p_bucket: 'comment' });
    expect(res.ok).toBe(true);
  });
  it('exports the full bucket set for the wiring map', () => {
    expect(BUCKETS).toContain('comment');
    expect(BUCKETS).toContain('admin');
    expect(BUCKETS).toContain('donate');       // Stripe donation intake bucket (Phase 3)
    expect(BUCKETS).not.toContain('login');   // login is the in-memory limiter, not a DB bucket
  });
  it('blocks when the RPC returns false', async () => {
    const res = await rateLimit(mkSupabase(vi.fn().mockResolvedValue({ data: false, error: null })), 'pledge');
    expect(res.ok).toBe(false);
  });
  it('FAILS OPEN when the RPC errors (limiter outage must never block users)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await rateLimit(
      mkSupabase(vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })), 'engage');
    expect(res.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('loginLimited (in-memory, per-IP)', () => {
  it('allows up to 10 in the window, blocks the 11th, keyed per IP', () => {
    __resetLoginLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(loginLimited('1.2.3.4', t0 + i)).toBe(false);
    expect(loginLimited('1.2.3.4', t0 + 10)).toBe(true);     // 11th blocked
    expect(loginLimited('5.6.7.8', t0 + 10)).toBe(false);    // other IP unaffected
  });
  it('forgets attempts after the 15-minute window', () => {
    __resetLoginLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 11; i++) loginLimited('1.2.3.4', t0 + i);
    expect(loginLimited('1.2.3.4', t0 + 15 * 60_000 + 100)).toBe(false);
  });
});
