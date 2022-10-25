<script>
  import { createClient } from "@supabase/supabase-js";
  import { onMount } from "svelte";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let data = "";

  const handler = async () => {
    try {
      const { data, error } = await supabase.from("ideas").select(`
    *,
    superprojects!inner(*),
    idea_user_likes!inner(*),
    categories!inner(*),
    idea_idea_relation!idea_idea_relation_parent_fkey!inner(child!inner(*))
    `);
      if (data) return data;
      else return error;
    } catch (e) {
      return "caught";
    }
  };
  onMount(async () => {
    [data] = await Promise.all([handler()]);
    console.log(data);
  });

  /**
     * 
{
    "message": "Could not embed because more than one relationship was found for 'ideas' and 'comments'",
    "details": [
        {
            "relationship": "public.comments[comments_idea_fkey][comments_reply_to_fkey]",
            "embedding": "ideas with comments",
            "cardinality": "many-to-many"
        },
        {
            "relationship": "comments_idea_fkey[id][idea]",
            "embedding": "ideas with comments",
            "cardinality": "one-to-many"
        }
    ],
    "hint": "Try changing 'comments' to one of the following: 'comments!comments', 'comments!comments_idea_fkey'. Find the desired relationship in the 'details' key."
}

{
    "message": "Could not embed because more than one relationship was found for 'ideas' and 'idea_idea_relation'",
    "details": [
        {
            "relationship": "idea_idea_relation_idea_1_fkey[id][idea_1]",
            "embedding": "ideas with idea_idea_relation",
            "cardinality": "one-to-many"
        },
        {
            "relationship": "idea_idea_relation_idea_2_fkey[id][idea_2]",
            "embedding": "ideas with idea_idea_relation",
            "cardinality": "one-to-many"
        }
    ],
    "hint": "Try changing 'idea_idea_relation' to one of the following: 'idea_idea_relation!idea_idea_relation_idea_1_fkey', 'idea_idea_relation!idea_idea_relation_idea_2_fkey'. Find the desired relationship in the 'details' key."
}
    */
</script>

{data ? JSON.stringify(data[0]) : "empty"}
