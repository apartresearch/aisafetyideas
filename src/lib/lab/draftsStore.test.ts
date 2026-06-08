import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDraftsStore } from './draftsStore.svelte';

beforeEach(() => { vi.restoreAllMocks(); });

describe('draftsStore', () => {
	it('adds optimistically then reconciles to the server id/slug', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'real', slug: 'sl' }) }));
		const s = createDraftsStore([]);
		const tmp = s.add('My idea');
		expect(s.drafts[0].title).toBe('My idea');
		expect(s.drafts[0].pending).toBe(true);
		await tmp;
		expect(s.drafts[0].id).toBe('real');
		expect(s.drafts[0].slug).toBe('sl');
		expect(s.drafts[0].pending).toBe(false);
	});
	it('marks errored on failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'x' }) }));
		const s = createDraftsStore([]);
		await s.add('X');
		expect(s.drafts[0].errored).toBe(true);
	});
});
