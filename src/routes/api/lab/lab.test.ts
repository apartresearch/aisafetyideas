import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/ai', () => ({
	generateStructured: vi.fn().mockResolvedValue({ reviewers: [{ persona: 'skeptic', comments: ['c'], questions: ['q'] }] }),
	generate: vi.fn()
}));
vi.mock('$lib/server/lab/access', () => ({ canUseLabAi: vi.fn().mockResolvedValue(true) }));

import { POST } from './[id]/review/+server';

function ev(rpcOk = true) {
	const idea = { id: 'i1', title: 'T', summary_md: 'n', expansions: {} };
	const single = () => Promise.resolve({ data: idea, error: null });
	const supabase: any = {
		rpc: vi.fn().mockResolvedValue({ data: rpcOk, error: null }),
		from: vi.fn(() => ({ select: () => ({ eq: () => ({ single }) }), update: () => ({ eq: () => Promise.resolve({ error: null }) }) }))
	};
	return { params: { id: 'i1' }, locals: { supabase, safeGetSession: async () => ({ user: { id: 'u1' } }) } } as any;
}

describe('POST /api/lab/[id]/review', () => {
	it('appends a critique round', async () => {
		const res = await POST(ev()); expect(res.status).toBe(200);
		const j = await res.json(); expect(j.round.reviewers[0].persona).toBe('skeptic');
	});
});
