import { describe, it, expect, vi } from 'vitest';
import { actions } from './+page.server';
import { RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

function mkEvent(rpcData: boolean) {
  const supabase: any = {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
    // 'ideas' → slug→id resolution (resolveIdeaId); anything else → insert (the comment write)
    from: vi.fn((table: string) =>
      table === 'ideas'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'idea-uuid-1' }, error: null }) }) }) }
        : { insert: vi.fn().mockResolvedValue({ error: null }) }
    )
  };
  const fd = new FormData();
  fd.set('body_md', 'hello');
  return {
    params: { slug: 'a-slug' },
    request: { formData: async () => fd },
    locals: { supabase, safeGetSession: async () => ({ user: { id: 'user-1' } }) }
  } as any;
}

describe('comment action rate limiting', () => {
  it('returns 429 with the shared message when over limit, before any insert', async () => {
    const event = mkEvent(false);
    const res: any = await (actions as any).comment(event);
    expect(res?.status).toBe(429);
    expect(res?.data?.message).toBe(RATE_LIMIT_MESSAGE);
    expect(event.locals.supabase.from).not.toHaveBeenCalled();   // guard precedes the write
  });
  it('proceeds to the insert when under limit', async () => {
    const event = mkEvent(true);
    await (actions as any).comment(event);
    expect(event.locals.supabase.from).toHaveBeenCalledWith('comments');
  });
});
