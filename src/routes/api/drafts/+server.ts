import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimit } from '$lib/server/rate-limit';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ message: 'Sign in' }, { status: 401 });
	if (!(await rateLimit(supabase, 'idea_create')).ok) return json({ message: 'Slow down' }, { status: 429 });
	const body = await request.json().catch(() => ({}));
	const title = String(body.title ?? '').trim() || 'Untitled idea';
	const { data, error: e } = await supabase
		.from('ideas').insert({ author_id: user.id, title, type: 'open_ended', status: 'draft' })
		.select('id, slug').single();
	if (e || !data) return json({ message: e?.message ?? 'Failed' }, { status: 400 });
	return json({ id: data.id, slug: data.slug });
};
