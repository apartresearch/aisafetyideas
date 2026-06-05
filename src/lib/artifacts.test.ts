import { describe, it, expect } from 'vitest';
import { inferKind } from './artifacts';

describe('inferKind', () => {
  it('detects github', () => expect(inferKind('https://github.com/org/repo')).toBe('github'));
  it('detects colab', () => expect(inferKind('https://colab.research.google.com/drive/abc')).toBe('colab'));
  it('detects pdf', () => expect(inferKind('https://example.com/paper.pdf')).toBe('pdf'));
  it('defaults http to url', () => expect(inferKind('https://example.com/x')).toBe('url'));
  it('non-url => other', () => expect(inferKind('mailto:me@x.com')).toBe('other'));
});
