export type ExpansionStatus = 'ready' | 'soon';
export type Expansion = {
  key: string; label: string; icon: string; gated: boolean; status: ExpansionStatus;
  kind: 'client' | 'review' | 'plan'; planKind?: 'exec' | 'readable';
};

export const EXPANSIONS: Expansion[] = [
  { key: 'review', label: 'Run review', icon: '🔍', gated: true, status: 'ready', kind: 'review' },
  { key: 'exec_plan', label: 'Generate ExecPlan', icon: '📐', gated: true, status: 'ready', kind: 'plan', planKind: 'exec' },
  { key: 'readable_plan', label: 'Generate readable plan', icon: '📄', gated: true, status: 'ready', kind: 'plan', planKind: 'readable' },
  { key: 'copy_agent', label: 'Copy to agent', icon: '🤖', gated: false, status: 'ready', kind: 'client' },
  { key: 'github', label: 'Start GitHub repo', icon: '🐙', gated: true, status: 'soon', kind: 'client' },
  { key: 'venues', label: 'Find venues', icon: '🎓', gated: true, status: 'soon', kind: 'client' },
  { key: 'link_agent', label: 'Link an agent', icon: '🔗', gated: true, status: 'soon', kind: 'client' }
];
