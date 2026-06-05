export const KINDS = ['github', 'pdf', 'colab', 'url', 'other'] as const;
export type ArtifactKind = (typeof KINDS)[number];

export function inferKind(url: string): ArtifactKind {
  const u = url.trim().toLowerCase();
  if (u.includes('github.com')) return 'github';
  if (u.includes('colab.research.google.com')) return 'colab';
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.startsWith('http://') || u.startsWith('https://')) return 'url';
  return 'other';
}
