import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canUseLabAi } from '$lib/server/lab/access';
import { generateStructured } from '$lib/server/ai';
import { rateLimit } from '$lib/server/rate-limit';
import { CritiqueRoundSchema, buildReviewPrompt } from '$lib/lab/critique';

export const POST: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ message: 'Sign in' }, { status: 401 });
	if (!(await canUseLabAi(supabase))) return json({ message: 'AI Lab is for experts, admins, and supporters' }, { status: 403 });
	if (!(await rateLimit(supabase, 'ai_generate')).ok) return json({ message: 'AI rate limit reached' }, { status: 429 });

	const { data: idea, error: ge } = await supabase.from('ideas')
		.select('id, title, summary_md, expansions').eq('id', params.id).single();
	if (ge || !idea) return json({ message: 'Draft not found' }, { status: 404 });

	let round;
	try {
		round = await generateStructured(buildReviewPrompt(idea.title, idea.summary_md ?? ''), CritiqueRoundSchema);
	} catch (e) {
		return json({ message: (e as Error).message || 'AI failed' }, { status: 502 });
	}
	const prev = Array.isArray((idea.expansions as any)?.critiques) ? (idea.expansions as any).critiques : [];
	const entry = { round: prev.length + 1, reviewers: round.reviewers };
	const expansions = { ...(idea.expansions as any), critiques: [...prev, entry] };
	const { error: ue } = await supabase.from('ideas').update({ expansions }).eq('id', params.id).eq('status', 'draft');
	if (ue) return json({ message: ue.message }, { status: 400 });
	return json({ round: entry });
};
