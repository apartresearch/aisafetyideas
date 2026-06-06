import { describe, it, expect } from 'vitest';
import { parseCopyBlock } from './parse-dump';

const DUMP = [
  'CREATE TABLE public.ideas (id bigint);',
  'COPY public.ideas (id, title, summary, archived) FROM stdin;',
  '1\tHello\tA \\t tabbed\\nline\t f',
  '2\t\\N\tplain\tt',
  '\\.',
  'COPY public.other (x) FROM stdin;',
  '9',
  '\\.'
].join('\n');

describe('parseCopyBlock', () => {
  it('extracts columns + rows for the named table, unescaping and \\N→null', () => {
    const b = parseCopyBlock(DUMP, 'public.ideas');
    expect(b.columns).toEqual(['id', 'title', 'summary', 'archived']);
    expect(b.rows.length).toBe(2);
    expect(b.rows[0]).toEqual({ id: '1', title: 'Hello', summary: 'A \t tabbed\nline', archived: ' f' });
    expect(b.rows[1]).toEqual({ id: '2', title: null, summary: 'plain', archived: 't' });
  });
  it('throws if the table COPY block is absent', () => {
    expect(() => parseCopyBlock(DUMP, 'public.missing')).toThrow();
  });
});
