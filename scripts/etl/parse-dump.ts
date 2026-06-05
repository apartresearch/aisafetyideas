export type CopyBlock = { columns: string[]; rows: Record<string, string | null>[] };

const UNESCAPE: Record<string, string> = { t: '\t', n: '\n', r: '\r', '\\': '\\' };

function unescapeField(f: string): string | null {
  if (f === '\\N') return null;
  return f.replace(/\\(.)/g, (_, c) => UNESCAPE[c] ?? c);
}

/** Parse a single `COPY <table> (cols) FROM stdin;` … `\.` block from a pg_dump text. */
export function parseCopyBlock(dump: string, table: string): CopyBlock {
  const lines = dump.split('\n');
  const startRe = new RegExp(`^COPY ${table.replace('.', '\\.')} \\(([^)]*)\\) FROM stdin;`);
  let i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) throw new Error(`COPY block for ${table} not found`);
  const columns = startRe.exec(lines[i])![1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string | null>[] = [];
  for (i = i + 1; i < lines.length && lines[i] !== '\\.'; i++) {
    const fields = lines[i].split('\t');
    const row: Record<string, string | null> = {};
    columns.forEach((c, j) => (row[c] = unescapeField(fields[j] ?? '\\N')));
    rows.push(row);
  }
  return { columns, rows };
}
