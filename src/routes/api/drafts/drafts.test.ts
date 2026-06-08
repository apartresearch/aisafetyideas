import { describe, it, expect, vi } from 'vitest';
import { POST } from './+server';

function ev(rpcOk: boolean, user: any = { id: 'u1' }) {
	const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'i1', slug: 's' }, error: null }) }) }));
	const supabase: any = { rpc: vi.fn().mockResolvedValue({ data: rpcOk, error: null }), from: vi.fn(() => ({ insert })) };
	return { request: { json: async () => ({ title: 'T' }) }, locals: { supabase, safeGetSession: async () => ({ user }) } } as any;
}

describe('POST /api/drafts', () => {
	it('401 without a user', async () => { expect((await POST(ev(true, null))).status).toBe(401); });
	it('429 when rate-limited', async () => { expect((await POST(ev(false))).status).toBe(429); });
	it('creates a draft and returns id+slug', async () => {
		const res = await POST(ev(true)); expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ id: 'i1', slug: 's' });
	});
});
