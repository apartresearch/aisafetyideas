import { z } from 'zod';

export const REVIEWERS = [
  { key: 'skeptic', label: 'Skeptic', brief: 'attack the weakest assumptions' },
  { key: 'methods', label: 'Methods', brief: 'rigor, baselines, confounds, measurability' },
  { key: 'impact', label: 'Impact', brief: 'why it matters for AI safety; who funds it' },
  { key: 'clarifying', label: 'Clarifying', brief: 'what is underspecified' }
] as const;

export const CritiqueRoundSchema = z.object({
  reviewers: z.array(z.object({
    persona: z.enum(['skeptic', 'methods', 'impact', 'clarifying']),
    comments: z.array(z.string()),
    questions: z.array(z.string())
  })).min(1)
});
export type CritiqueRound = z.infer<typeof CritiqueRoundSchema>;

/** Prompt for one review round over a draft. */
export function buildReviewPrompt(title: string, notes_md: string): string {
  const panel = REVIEWERS.map((r) => `- ${r.label}: ${r.brief}`).join('\n');
  return `You are a panel reviewing an early-stage AI-safety research idea.\n` +
    `Idea: "${title}"\nNotes:\n${notes_md || '(none yet)'}\n\n` +
    `Reviewers:\n${panel}\n\nReturn each reviewer's pointed comments and clarifying questions.`;
}
