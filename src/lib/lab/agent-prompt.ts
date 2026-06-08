export type AgentPromptInput = {
  title: string; notes_md: string;
  execPlan?: string | null; readablePlan?: string | null;
};

/** Format a draft (+ optional distilled plans) into a single agent handoff prompt. */
export function buildAgentPrompt(i: AgentPromptInput): string {
  const parts = [`# Research idea: ${i.title}`];
  if (i.notes_md.trim()) parts.push(`## Notes\n${i.notes_md.trim()}`);
  if (i.readablePlan?.trim()) parts.push(`## Plan (readable)\n${i.readablePlan.trim()}`);
  if (i.execPlan?.trim()) parts.push(`## ExecPlan\n${i.execPlan.trim()}`);
  parts.push('## Task\nBuild this out: produce the paper/artifacts described above.');
  return parts.join('\n\n');
}
