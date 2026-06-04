import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function mkLocals(profile: unknown) {
  return {
    supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }) }) },
    safeGetSession: async () => ({ session: null, user: null })
  } as any;
}

describe('profile load', () => {
  it('returns the profile when found', async () => {
    const profile = { id: 'p1', handle: 'alice', display_name: 'Alice' };
    const res = await load({ params: { handle: 'alice' }, locals: mkLocals(profile) } as any) as any;
    expect(res.profile.handle).toBe('alice');
  });
  it('404s when not found', async () => {
    await expect(load({ params: { handle: 'nope' }, locals: mkLocals(null) } as any)).rejects.toMatchObject({ status: 404 });
  });
});
