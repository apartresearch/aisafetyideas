import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/ai', () => ({
	generateStructured: vi.fn().mockResolvedValue({ reviewers: [{ persona: 'skeptic', comments: ['c'], questions: ['q'] }] }),
	generate: vi.fn().mockResolvedValue('PLAN')
}));
vi.mock('$lib/server/lab/access', () => ({ canUseLabAi: vi.fn().mockResolvedValue(true) }));
vi.mock('$lib/server/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true }) }));

import { POST } from './[id]/review/+server';
import { POST as planPOST } from './[id]/plan/+server';
import { canUseLabAi } from '$lib/server/lab/access';
import { generateStructured } from '$lib/server/ai';
import { rateLimit } from '$lib/server/rate-limit';

/** Returns an infinitely chainable eq/single stub. */
function eqChain(leaf: () => any): any {
	const chain: any = { eq: () => chain, single: leaf };
	return chain;
}

function ev(rpcOk = true) {
	const idea = { id: 'i1', title: 'T', summary_md: 'n', expansions: {} };
	const supabase: any = {
		rpc: vi.fn().mockResolvedValue({ data: rpcOk, error: null }),
		from: vi.fn(() => ({
			select: () => eqChain(() => Promise.resolve({ data: idea, error: null })),
			update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) })
		}))
	};
	return { params: { id: 'i1' }, locals: { supabase, safeGetSession: async () => ({ user: { id: 'u1' } }) } } as any;
}

function planEv(body: object = { kind: 'exec' }) {
	const idea = { id: 'i1', title: 'T', summary_md: 'n', expansions: {} };
	let capturedExpansions: any;
	const supabase: any = {
		rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
		from: vi.fn(() => ({
			select: () => eqChain(() => Promise.resolve({ data: idea, error: null })),
			update: (upd: any) => { capturedExpansions = upd.expansions; return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; }
		}))
	};
	(supabase as any).__getExpansions = () => capturedExpansions;
	return {
		params: { id: 'i1' },
		request: { json: async () => body, clone: () => ({ json: async () => body }) } as any,
		locals: { supabase, safeGetSession: async () => ({ user: { id: 'u1' } }) }
	} as any;
}

describe('POST /api/lab/[id]/review', () => {
	it('appends a critique round', async () => {
		const res = await POST(ev()); expect(res.status).toBe(200);
		const j = await res.json(); expect(j.round.reviewers[0].persona).toBe('skeptic');
	});

	it('returns 403 and does not call generateStructured when canUseLabAi is false', async () => {
		vi.mocked(canUseLabAi).mockResolvedValueOnce(false);
		vi.mocked(generateStructured).mockClear();
		const res = await POST(ev());
		expect(res.status).toBe(403);
		expect(generateStructured).not.toHaveBeenCalled();
	});

	it('returns 429 and does not call generateStructured when rateLimit returns ok:false', async () => {
		vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false });
		vi.mocked(generateStructured).mockClear();
		const res = await POST(ev());
		expect(res.status).toBe(429);
		expect(generateStructured).not.toHaveBeenCalled();
	});
});

describe('POST /api/lab/[id]/plan', () => {
	it('returns 200 with kind and md, and stores exec_plan_md in expansions', async () => {
		const event = planEv({ kind: 'exec' });
		const res = await planPOST(event);
		expect(res.status).toBe(200);
		const j = await res.json();
		expect(j.kind).toBe('exec');
		expect(j.md).toBe('PLAN');
		const expansions = event.locals.supabase.__getExpansions();
		expect(expansions).toHaveProperty('exec_plan_md');
		expect(expansions.exec_plan_md.md).toBe('PLAN');
	});
});
