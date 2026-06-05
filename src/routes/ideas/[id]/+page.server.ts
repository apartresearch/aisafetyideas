import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id')
    .eq('id', params.id)
    .single();                       // RLS returns null if not visible (draft of another user)
  if (!idea) error(404, 'Idea not found');
  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };
  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);
  return { idea, author, categories: (cats ?? []).map((c: any) => c.categories) };
};
