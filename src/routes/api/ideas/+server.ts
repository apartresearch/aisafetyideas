import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadIdeaFeed, parseSort } from '$lib/server/idea-feed';

// Infinite-scroll data source for the ideas page: returns one page of the same feed the SSR loader
// renders (scores attached, archived/draft excluded). RLS still governs row visibility via `supabase`.
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const type = url.searchParams.get('type');
  const sort = parseSort(url.searchParams.get('sort'));
  const page = Math.max(0, Math.trunc(Number(url.searchParams.get('page'))) || 0);
  const feed = await loadIdeaFeed(supabase, { type, sort, page });
  return json({ ideas: feed.ideas, page: feed.page, hasMore: feed.hasMore });
};
