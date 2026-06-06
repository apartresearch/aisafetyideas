import { describe, it, expect } from 'vitest';
import { lit, jsonbLit, insertRows } from './sql';

describe('sql helpers', () => {
  it('lit() quotes + doubles single-quotes; null→NULL; raw SQL passes through', () => {
    expect(lit(null)).toBe('NULL');
    expect(lit("O'Brien")).toBe("'O''Brien'");
    expect(lit('a\\b')).toBe("'a\\b'");                 // backslash literal (standard_conforming_strings)
    expect(lit({ sql: 'now()' })).toBe('now()');
  });
  it('jsonbLit() emits a cast jsonb literal, dropping undefined keys', () => {
    expect(jsonbLit({ a: 1, b: undefined, c: "x'y" })).toBe('\'{"a":1,"c":"x\'\'y"}\'::jsonb');
  });
  it('insertRows() builds an idempotent multi-row INSERT', () => {
    const sql = insertRows('public.t', ['id', 'name'], [
      { id: lit('1'), name: lit("A'B") },
      { id: lit('2'), name: 'NULL' }
    ], 'id');
    expect(sql).toContain('insert into public.t (id, name) values');
    expect(sql).toContain("('1', 'A''B')");
    expect(sql).toContain("('2', NULL)");
    expect(sql.trim().endsWith('on conflict (id) do nothing;')).toBe(true);
  });
  it('insertRows() returns empty string for no rows', () => {
    expect(insertRows('public.t', ['id'], [], 'id')).toBe('');
  });
  it('insertRows() omits the conflict target when null (arbitrates any unique index)', () => {
    const sql = insertRows('public.t', ['id'], [{ id: lit('1') }], null);
    expect(sql.trim().endsWith('on conflict do nothing;')).toBe(true);
  });
  it('insertRows() throws when a row is missing a listed column', () => {
    expect(() => insertRows('public.t', ['id', 'name'], [{ id: "'1'" }], null)).toThrow(/missing column name/);
  });
});
