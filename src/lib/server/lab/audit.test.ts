import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/ai', () => ({
	generateStructured: vi.fn().mockResolvedValue({ missingSections: ['Methodology'], notes: ['add a baseline'] }),
	generate: vi.fn().mockResolvedValue(''),
}));

import { auditAgainstTemplate, AuditSchema } from './audit';
import { generateStructured } from '$lib/server/ai';

describe('auditAgainstTemplate', () => {
	it('returns the mocked structured result', async () => {
		const result = await auditAgainstTemplate('idea', 'Some idea text here');
		expect(result.missingSections).toEqual(['Methodology']);
		expect(result.notes).toEqual(['add a baseline']);
	});

	it('passes a prompt that includes idea section names for kind=idea', async () => {
		vi.mocked(generateStructured).mockClear();
		await auditAgainstTemplate('idea', 'Some idea text');
		expect(vi.mocked(generateStructured)).toHaveBeenCalledTimes(1);
		const prompt = vi.mocked(generateStructured).mock.calls[0][0];
		expect(prompt).toContain('Summary');
		expect(prompt).toContain('Resolution criteria');
		expect(prompt).toContain('Methodology');
		expect(prompt).toContain('Theory of change');
		expect(prompt).toContain('Extensions');
	});

	it('passes answer section names for kind=answer', async () => {
		vi.mocked(generateStructured).mockClear();
		await auditAgainstTemplate('answer', 'Some answer text');
		const prompt = vi.mocked(generateStructured).mock.calls[0][0];
		expect(prompt).toContain('Approach / method');
		expect(prompt).toContain('Evidence / results');
		expect(prompt).toContain('Limitations');
		// idea-only sections should NOT appear
		expect(prompt).not.toContain('Theory of change');
	});

	it('passes the provided text through to the prompt', async () => {
		vi.mocked(generateStructured).mockClear();
		await auditAgainstTemplate('idea', 'unique-text-marker-XYZ');
		const prompt = vi.mocked(generateStructured).mock.calls[0][0];
		expect(prompt).toContain('unique-text-marker-XYZ');
	});
});

describe('AuditSchema', () => {
	it('accepts a valid audit object', () => {
		const res = AuditSchema.safeParse({ missingSections: ['Methodology'], notes: ['short note'] });
		expect(res.success).toBe(true);
	});

	it('accepts empty arrays', () => {
		const res = AuditSchema.safeParse({ missingSections: [], notes: [] });
		expect(res.success).toBe(true);
	});

	it('rejects a malformed object (notes must be array)', () => {
		const res = AuditSchema.safeParse({ missingSections: [], notes: 'not an array' });
		expect(res.success).toBe(false);
	});

	it('rejects a malformed object (missingSections must be array)', () => {
		const res = AuditSchema.safeParse({ missingSections: 42, notes: [] });
		expect(res.success).toBe(false);
	});

	it('rejects missing required fields', () => {
		const res = AuditSchema.safeParse({ missingSections: ['x'] });
		expect(res.success).toBe(false);
	});
});
