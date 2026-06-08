import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canUseLabAi } from '$lib/server/lab/access';
import { generate } from '$lib/server/ai';
import { rateLimit } from '$lib/server/rate-limit';

const PROMPTS = {
	exec: (t: string, n: string) => `Write a concise, agent-EXECUTABLE plan (markdown) to investigate this AI-safety idea.\nSections: Objective, Method (numbered steps), Artifacts, Success criteria, Risks.\nIdea: "${t}"\nNotes:\n${n}`,
	readable: (t: string, n: string) => `Write a readable proto-paper plan (markdown): motivation, approach, expected contribution.\nIdea: "${t}"\nNotes:\n${n}`
};

export const POST: RequestHandler = async ({ params, request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ message: 'Sign in' }, { status: 401 });
	if (!(await canUseLabAi(supabase))) return json({ message: 'AI Lab is for experts, admins, and supporters' }, { status: 403 });
	if (!(await rateLimit(supabase, 'ai_generate')).ok) return json({ message: 'AI rate limit reached' }, { status: 429 });
	const body = await request.json().catch(() => ({}));
	const kind: 'exec' | 'readable' = body.kind === 'readable' ? 'readable' : 'exec';

	const { data: idea, error: ge } = await supabase.from('ideas').select('id, title, summary_md, expansions').eq('id', params.id).single();
	if (ge || !idea) return json({ message: 'Draft not found' }, { status: 404 });

	let md: string;
	try { md = await generate(PROMPTS[kind](idea.title, idea.summary_md ?? '')); }
	catch (e) { return json({ message: (e as Error).message || 'AI failed' }, { status: 502 }); }

	const key = kind === 'exec' ? 'exec_plan_md' : 'readable_plan_md';
	const expansions = { ...(idea.expansions as any), [key]: { md, at: new Date().toISOString() } };
	const { error: ue } = await supabase.from('ideas').update({ expansions }).eq('id', params.id);
	if (ue) return json({ message: ue.message }, { status: 400 });
	return json({ kind, md });
};
