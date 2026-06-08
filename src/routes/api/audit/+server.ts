import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canUseLabAi } from '$lib/server/lab/access';
import { rateLimit } from '$lib/server/rate-limit';
import { auditAgainstTemplate } from '$lib/server/lab/audit';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ message: 'Sign in' }, { status: 401 });
	if (!(await canUseLabAi(supabase))) return json({ message: 'AI Lab is for experts, admins, and supporters' }, { status: 403 });
	if (!(await rateLimit(supabase, 'ai_generate')).ok) return json({ message: 'AI rate limit reached' }, { status: 429 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid JSON' }, { status: 400 });
	}
	const { kind, text } = body as { kind?: unknown; text?: unknown };
	if (kind !== 'idea' && kind !== 'answer') return json({ message: 'kind must be "idea" or "answer"' }, { status: 400 });
	if (!text || typeof text !== 'string' || !text.trim()) return json({ message: 'text is required' }, { status: 400 });

	let audit;
	try {
		audit = await auditAgainstTemplate(kind, text);
	} catch (e) {
		return json({ message: (e as Error).message || 'AI failed' }, { status: 502 });
	}
	return json(audit);
};
