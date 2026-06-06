export type Cell = string | null | { sql: string };

/** A SQL scalar literal. null→NULL; {sql} passes through verbatim; strings are single-quoted with '' escaping. */
export function lit(v: Cell): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return v.sql;
  return `'${v.replace(/'/g, "''")}'`;
}

/** A jsonb literal from a JS object (undefined values dropped). */
export function jsonbLit(obj: Record<string, unknown>): string {
  const clean = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  return `${lit(JSON.stringify(clean))}::jsonb`;
}

/** An idempotent multi-row INSERT. `cells` rows are pre-rendered SQL (use lit()/jsonbLit()). */
export function insertRows(
  table: string, columns: string[], rows: Record<string, string>[], conflictTarget?: string
): string {
  if (rows.length === 0) return '';
  const tuples = rows.map((r) => `  (${columns.map((c) => r[c] ?? 'NULL').join(', ')})`).join(',\n');
  const conflict = conflictTarget ? `on conflict (${conflictTarget}) do nothing;` : 'on conflict do nothing;';
  return `insert into ${table} (${columns.join(', ')}) values\n${tuples}\n${conflict}\n`;
}
