import { describe, it, expect } from 'vitest';
import { buildAgentPrompt } from './agent-prompt';
describe('buildAgentPrompt', () => {
  it('includes title, notes, and plans when present', () => {
    const p = buildAgentPrompt({
      title: 'Scalable oversight', notes_md: 'via debate',
      execPlan: '1. do X', readablePlan: 'We propose…'
    });
    expect(p).toContain('Scalable oversight');
    expect(p).toContain('via debate');
    expect(p).toContain('1. do X');
    expect(p).toContain('We propose…');
  });
  it('omits plan sections that are absent', () => {
    const p = buildAgentPrompt({ title: 'T', notes_md: '', execPlan: null, readablePlan: null });
    expect(p).toContain('T');
    expect(p).not.toMatch(/ExecPlan/i);
  });
});
