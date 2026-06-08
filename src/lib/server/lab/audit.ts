import { z } from 'zod';
import { generateStructured } from '$lib/server/ai';

export const AuditSchema = z.object({
	missingSections: z.array(z.string()),
	notes: z.array(z.string())
});
export type Audit = z.infer<typeof AuditSchema>;

const IDEA_SECTIONS = ['Summary', 'Resolution criteria', 'Methodology', 'Theory of change', 'Extensions'];
const ANSWER_SECTIONS = ['Approach / method', 'Evidence / results', 'Limitations'];

// Assistive, never-blocking structure check. Returns which template sections look missing or thin,
// plus short notes. Pure seam over generateStructured so it's mockable.
export async function auditAgainstTemplate(kind: 'idea' | 'answer', text: string): Promise<Audit> {
	const sections = kind === 'idea' ? IDEA_SECTIONS : ANSWER_SECTIONS;
	const prompt =
		`You are reviewing a research ${kind} for structural completeness only (not quality).\n` +
		`Expected sections: ${sections.join(', ')}.\n` +
		`Given the ${kind} text below, list which expected sections appear MISSING or too thin, and up to 3 short, ` +
		`constructive notes. Do not rewrite the ${kind}. Text:\n"""\n${text}\n"""`;
	return generateStructured(prompt, AuditSchema);
}
