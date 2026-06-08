export type DraftRow = {
	id: string; slug: string | null; title: string; pending: boolean; errored: boolean;
};

let tmpSeq = 0;

export function createDraftsStore(initial: { id: string; slug: string; title: string }[]) {
	const drafts = $state<DraftRow[]>(initial.map((d) => ({ ...d, pending: false, errored: false })));

	async function add(title: string) {
		const tmpId = `tmp-${tmpSeq++}`;
		drafts.unshift({ id: tmpId, slug: null, title, pending: true, errored: false });
		const row = drafts[0];
		try {
			const res = await fetch('/api/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) });
			if (!res.ok) throw new Error((await res.json()).message);
			const { id, slug } = await res.json();
			row.id = id; row.slug = slug; row.pending = false;
		} catch { row.errored = true; row.pending = false; }
	}

	function remove(id: string) {
		const i = drafts.findIndex((d) => d.id === id);
		if (i >= 0) {
			const [r] = drafts.splice(i, 1);
			if (!id.startsWith('tmp-')) fetch(`/api/drafts/${id}`, { method: 'DELETE' });
			return r;
		}
	}

	return { drafts, add, remove };
}
