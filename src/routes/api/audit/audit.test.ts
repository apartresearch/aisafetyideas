import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/lab/access', () => ({ canUseLabAi: vi.fn().mockResolvedValue(true) }));
vi.mock('$lib/server/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock('$lib/server/lab/audit', () => ({
	auditAgainstTemplate: vi.fn().mockResolvedValue({ missingSections: ['Methodology'], notes: ['add a baseline'] }),
}));

import { POST } from './+server';
import { canUseLabAi } from '$lib/server/lab/access';
import { rateLimit } from '$lib/server/rate-limit';
import { auditAgainstTemplate } from '$lib/server/lab/audit';

function makeEvent(body: unknown, user: { id: string } | null = { id: 'u1' }) {
	const supabase: any = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
	return {
		request: {
			json: async () => body,
		},
		locals: {
			supabase,
			safeGetSession: async () => ({ user }),
		},
	} as any;
}

describe('POST /api/audit', () => {
	it('returns 401 when there is no user', async () => {
		const res = await POST(makeEvent({ kind: 'idea', text: 'hi' }, null));
		expect(res.status).toBe(401);
	});

	it('returns 403 when canUseLabAi is false', async () => {
		vi.mocked(canUseLabAi).mockResolvedValueOnce(false);
		const res = await POST(makeEvent({ kind: 'idea', text: 'hi' }));
		expect(res.status).toBe(403);
		expect(auditAgainstTemplate).not.toHaveBeenCalled();
	});

	it('returns 429 when rate limited', async () => {
		vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false });
		const res = await POST(makeEvent({ kind: 'idea', text: 'hi' }));
		expect(res.status).toBe(429);
		expect(auditAgainstTemplate).not.toHaveBeenCalled();
	});

	it('returns 400 for unknown kind', async () => {
		const res = await POST(makeEvent({ kind: 'unknown', text: 'hi' }));
		expect(res.status).toBe(400);
	});

	it('returns 400 for empty text', async () => {
		const res = await POST(makeEvent({ kind: 'idea', text: '' }));
		expect(res.status).toBe(400);
	});

	it('returns 400 for whitespace-only text', async () => {
		const res = await POST(makeEvent({ kind: 'idea', text: '   ' }));
		expect(res.status).toBe(400);
	});

	it('returns 400 for missing text', async () => {
		const res = await POST(makeEvent({ kind: 'idea' }));
		expect(res.status).toBe(400);
	});

	it('returns 200 with audit payload on happy path (kind=idea)', async () => {
		vi.mocked(auditAgainstTemplate).mockClear();
		const res = await POST(makeEvent({ kind: 'idea', text: 'some idea text' }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.missingSections).toEqual(['Methodology']);
		expect(body.notes).toEqual(['add a baseline']);
		expect(auditAgainstTemplate).toHaveBeenCalledWith('idea', 'some idea text');
	});

	it('returns 200 with audit payload on happy path (kind=answer)', async () => {
		vi.mocked(auditAgainstTemplate).mockClear();
		const res = await POST(makeEvent({ kind: 'answer', text: 'some answer text' }));
		expect(res.status).toBe(200);
		expect(auditAgainstTemplate).toHaveBeenCalledWith('answer', 'some answer text');
	});

	it('returns 502 when auditAgainstTemplate throws', async () => {
		vi.mocked(auditAgainstTemplate).mockRejectedValueOnce(new Error('AI timeout'));
		const res = await POST(makeEvent({ kind: 'idea', text: 'some text' }));
		expect(res.status).toBe(502);
	});
});
