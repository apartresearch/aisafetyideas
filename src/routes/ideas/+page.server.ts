import type { PageServerLoad } from './$types';
import { loadIdeaFeed, parseSort } from '$lib/server/idea-feed';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const type = url.searchParams.get('type'); // 'hypothesis' | 'open_ended' | null
  const sort = parseSort(url.searchParams.get('sort')); // default 'top' = net upvotes
  const feed = await loadIdeaFeed(supabase, { type, sort, page: 0 });
  return { ...feed, type, sort };
};
