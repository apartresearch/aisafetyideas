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
		const keyBefore = s.drafts[0].key;
		await tmp;
		expect(s.drafts[0].id).toBe('real');
		expect(s.drafts[0].slug).toBe('sl');
		expect(s.drafts[0].pending).toBe(false);
		// key must remain stable after id reconcile (prevents expand-collapse DOM reset)
		expect(s.drafts[0].key).toBe(keyBefore);
	});
	it('seed rows get key === id', () => {
		const s = createDraftsStore([{ id: 'seed-1', slug: 'sl', title: 'Seeded' }]);
		expect(s.drafts[0].key).toBe('seed-1');
	});
	it('marks errored on failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'x' }) }));
		const s = createDraftsStore([]);
		await s.add('X');
		expect(s.drafts[0].errored).toBe(true);
	});
	it('remove(tmp-*) splices locally without calling DELETE', () => {
		const mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
		const s = createDraftsStore([]);
		// manually push a tmp row (simulates the in-flight state)
		(s.drafts as any).push({ id: 'tmp-0', slug: null, title: 'Unsaved', pending: true, errored: false });
		expect(s.drafts.length).toBe(1);
		s.remove('tmp-0');
		expect(s.drafts.length).toBe(0);
		expect(mockFetch).not.toHaveBeenCalled();
	});
	it('remove(real-id) calls DELETE and splices', () => {
		const mockFetch = vi.fn().mockResolvedValue({});
		vi.stubGlobal('fetch', mockFetch);
		const s = createDraftsStore([{ id: 'real-1', slug: 'sl', title: 'Saved' }]);
		s.remove('real-1');
		expect(s.drafts.length).toBe(0);
		expect(mockFetch).toHaveBeenCalledWith('/api/drafts/real-1', { method: 'DELETE' });
	});
});
