import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ message: 'Sign in' }, { status: 401 });
	const body = await request.json().catch(() => ({}));
	const patch: { title?: string; summary_md?: string } = {};
	if (typeof body.title === 'string') patch.title = body.title.trim() || 'Untitled idea';
	if (typeof body.notes_md === 'string') patch.summary_md = body.notes_md; // notes reuse summary_md
	if (!Object.keys(patch).length) return json({ ok: true });
	const { error: e } = await supabase.from('ideas').update(patch).eq('id', params.id).eq('status', 'draft');
	if (e) return json({ message: e.message }, { status: 400 });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ message: 'Sign in' }, { status: 401 });
	const { error: e } = await supabase.from('ideas').delete().eq('id', params.id).eq('status', 'draft');
	if (e) return json({ message: e.message }, { status: 400 });
	return json({ ok: true });
};
