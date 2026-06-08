import { describe, it, expect, vi } from 'vitest';
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'hello' }),
  generateObject: vi.fn().mockResolvedValue({ object: { ok: true } })
}));
vi.mock('$env/dynamic/private', () => ({ env: { AI_GATEWAY_API_KEY: 'test-key' } }));
import { generate, generateStructured } from './ai';
import { z } from 'zod';
describe('ai seam', () => {
  it('generate returns text', async () => { expect(await generate('hi')).toBe('hello'); });
  it('generateStructured returns the parsed object', async () => {
    expect(await generateStructured('hi', z.object({ ok: z.boolean() }))).toEqual({ ok: true });
  });
});
