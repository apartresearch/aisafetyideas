import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

/** Builds a chainable query builder that resolves with `result` at any terminal call or when awaited directly. */
function mkQuery(result: unknown) {
  const resolved = { data: result, error: null };
  const q: any = {
    select: () => q,
    eq: () => q,
    not: () => q,
    order: () => q,
    limit: () => q,
    single: async () => resolved,
    maybeSingle: async () => resolved,
    // Make the builder itself thenable so `await builder` works (for queries that end with .limit() etc.)
    then: (resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve)
  };
  return q;
}

function mkLocals(profile: unknown, expert: unknown = null, authored: unknown = []) {
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'experts') return mkQuery(expert);
        if (table === 'ideas') return mkQuery(authored);
        // profiles table — profile query
        return mkQuery(profile);
      }
    },
    safeGetSession: async () => ({ session: null, user: null })
  } as any;
}

describe('profile load', () => {
  it('returns the profile when found', async () => {
    const profile = { id: 'p1', handle: 'alice', display_name: 'Alice' };
    const res = await load({ params: { handle: 'alice' }, locals: mkLocals(profile) } as any) as any;
    expect(res.profile.handle).toBe('alice');
  });

  it('returns isVerifiedExpert=true for an approved expert', async () => {
    const profile = { id: 'p1', handle: 'alice', display_name: 'Alice' };
    const res = await load({
      params: { handle: 'alice' },
      locals: mkLocals(profile, { status: 'approved' }, [])
    } as any) as any;
    expect(res.isVerifiedExpert).toBe(true);
  });

  it('returns isVerifiedExpert=false for a non-expert', async () => {
    const profile = { id: 'p1', handle: 'alice', display_name: 'Alice' };
    const res = await load({
      params: { handle: 'alice' },
      locals: mkLocals(profile, null, [])
    } as any) as any;
    expect(res.isVerifiedExpert).toBe(false);
  });

  it('returns authored ideas array', async () => {
    const profile = { id: 'p1', handle: 'alice', display_name: 'Alice' };
    const ideas = [{ id: 'i1', slug: 'my-idea', title: 'My Idea', type: 'open_ended', status: 'open' }];
    const res = await load({
      params: { handle: 'alice' },
      locals: mkLocals(profile, null, ideas)
    } as any) as any;
    expect(res.authored).toHaveLength(1);
    expect(res.authored[0].slug).toBe('my-idea');
  });

  it('404s when not found', async () => {
    await expect(load({ params: { handle: 'nope' }, locals: mkLocals(null) } as any)).rejects.toMatchObject({ status: 404 });
  });
});
