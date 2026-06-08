import { describe, it, expect, vi } from 'vitest';
import { canUseLabAi } from './access';
describe('canUseLabAi', () => {
  it('returns the can_use_lab_ai RPC boolean', async () => {
    const supabase: any = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    expect(await canUseLabAi(supabase)).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('can_use_lab_ai');
  });
  it('is false when the RPC errors or returns null', async () => {
    const supabase: any = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) };
    expect(await canUseLabAi(supabase)).toBe(false);
  });
});
