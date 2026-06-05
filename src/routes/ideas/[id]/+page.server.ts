import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id')
    .eq('id', params.id)
    .single(); // RLS returns null if not visible (another user's draft)
  if (!idea) error(404, 'Idea not found');

  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };

  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);

  // RLS scopes which answers are returned: verified (public) + own + (for the author) all answers to this idea.
  // answers has FOUR FKs to profiles, so the submitter embed MUST name the constraint to disambiguate.
  const { data: rawAnswers } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, submitter_id,' +
        ' answer_artifacts(id, kind, url, label),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });

  // Normalise the to-one `submitter` embed (supabase-js may type/return it as an array) and hand AnswerCard a
  // plain shape. Mapping through `(a: any)` matches the Plan-2 embed precedent and keeps `npm run check` at 0 errors.
  const answers = (rawAnswers ?? []).map((a: any) => ({
    ...a,
    submitter: Array.isArray(a.submitter) ? (a.submitter[0] ?? null) : a.submitter
  }));

  return {
    idea,
    author,
    categories: (cats ?? []).map((c: any) => c.categories),
    answers,
    canSubmit: !!user && idea.status === 'open'
  };
};
