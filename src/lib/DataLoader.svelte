<script>
  import {
    user,
    users,
    ideas,
    comments,
    categories,
    problems,
    idea_likes,
    fundings,
    interests,
    mentorships,
    shownIdeas,
    categoryRelations,
    problemRelations,
    ideaRelations,
    loading,
    results,
    nodes,
    nodeIdeaRelations,
  } from "$lib/stores.js";
  import { onMount } from "svelte";
  import { getTable, supabase } from "$lib/db.js";

  onMount(async () => {
    let startTime = performance.now();
    if ($ideas.length != 0) {
      // Return if the ideas are already loaded
      console.log("Ideas already loaded");
      $loading = false;
      return 1;
    } else {
      // We load all tables to combine them manually
      [
        $users,
        $ideas,
        $comments,
        $categories,
        $problems,
        $idea_likes,
        $fundings,
        $interests,
        $mentorships,
        $categoryRelations,
        $problemRelations,
        $ideaRelations,
        $results,
        $nodes,
        $nodeIdeaRelations,
      ] = await Promise.all([
        getTable("users"),

        getTable(
          "ideas",
          true,
          process.env.PROJECT_FACTORY == "TRUE" ? true : false
        ),
        getTable("comments"),
        getTable(
          "categories",
          true,
          process.env.PROJECT_FACTORY == "TRUE" ? true : false
        ),
        getTable("problems"),
        getTable("idea_user_likes"),
        getTable("idea_user_funding_relation"),
        getTable("idea_user_interest_relation"),
        getTable("idea_user_mentorship_relation"),
        getTable("idea_category_relation"),
        getTable("idea_problem_relation"),
        getTable("idea_idea_relation"),
        getTable("results"),
        getTable("nodes"),
        getTable("nodes_ideas"),
      ]);

      let endTime = performance.now();

      $shownIdeas = [];

      console.log(`Time to load all data: ${endTime - startTime}ms`);

      // Setup the comments
      $comments = $comments.map((c) => ({
        ...c,
        username: $users.find((u) => u.id == c.author).username,
      }));
      $comments = $comments
        .map((c) => ({
          ...c,
          replies: $comments.filter((r) => r.reply_to == c.id),
        }))
        .filter((c) => c.reply_to == null || c.reply_to < 1);

      $interests = $interests.map((i) => ({
        ...i,
        username: $users.find((u) => u.id == i.user)
          ? $users.find((u) => u.id == i.user).username
          : "",
        image: $users.find((u) => u.id == i.user)
          ? $users.find((u) => u.id == i.user).image
          : "/images/person-outline (2).svg",
        career_stage: $users.find((u) => u.id == i.user)
          ? $users.find((u) => u.id == i.user).career_stage
          : "",
      }));

      $idea_likes = $idea_likes.map((i) => ({
        ...i,
        username: $users.find((u) => u.id == i.user)
          ? $users.find((u) => u.id == i.user).username
          : "",
        weight: $users.find((u) => u.id == i.user).like_weight,
        career_stage: $users.find((u) => u.id == i.user)
          ? $users.find((u) => u.id == i.user).career_stage
          : "",
      }));

      //   Setup the ideas
      $ideas = $ideas
        .filter((i) => i.filtered == true)
        .map((idea) => ({
          ...idea,
          nodes: $nodeIdeaRelations
            .filter(
              (r) => r.idea === idea.id && $nodes.some((n) => n.id == r.node)
            )
            .map((n) => ({
              ...n,
              node: $nodes.find((nn) => nn.id === n.node),
            })),
          likes: $idea_likes
            .filter((like) => like.idea === idea.id)
            .reduce((a, b) => a + b.weight, 0),
          user_liked: $idea_likes.find(
            (like) => like.idea === idea.id && $user && like.user === $user.id
          ),
          results: $results.filter((r) => r.idea == idea.id),
          username: $users.find((user) => user.id === idea.user)
            ? $users.find((user) => user.id === idea.user).username
            : "",
          comments_n:
            $comments.filter(
              (c) => (c.reply_to < 1 || !c.reply_to) && c.idea === idea.id
            ).length +
            $comments
              .filter(
                (c) => (c.reply_to < 1 || !c.reply_to) && c.idea === idea.id
              )
              .map((c) => c.replies.length)
              .reduce((a, b) => a + b, 0),
          categories: $categoryRelations
            .filter(
              (r) =>
                r.idea === idea.id &&
                $categories.some((c) => c.id == r.category)
            )
            .map((c) => ({
              ...c,
              category: $categories.find((cat) => cat.id === c.category),
            })),
          problems: $problemRelations
            .filter((r) => r.idea === idea.id)
            .map((p) => ({
              ...p,
              problem: $problems.find((pr) => pr.id === p.problem),
            })),
          ideas: $ideaRelations.filter((r) => r.idea === idea.id),
          comments: $comments.filter(
            (c) => (c.reply_to < 1 || !c.reply_to) && c.idea === idea.id
          ),
          interests: $interests.filter((i) => i.idea === idea.id),
          interests_n: $interests.filter((i) => i.idea === idea.id).length,
        }));

      $nodes = $nodes.map((l) => ({
        ...l,
        username: $users.find((u) => u.id == l.user).username,
        user_image: $users.find((u) => u.id == l.user).image,
        ideas: $nodeIdeaRelations
          .filter((r) => r.node == l.id)
          .map((r) => ({
            ...r,
            idea: $ideas.find((i) => i.id == r.idea),
          }))
          .filter((i) => i.idea),
      }));

      console.log($ideas);

      // Normalize the x1 and y1 of the ideas
      let x1 = $ideas.map((i) => i.x1);
      let y1 = $ideas.map((i) => i.y1);
      let x1_max = Math.max(...x1);
      let y1_max = Math.max(...y1);
      let x1_min = Math.min(...x1);
      let y1_min = Math.min(...y1);

      $ideas = $ideas.map((idea) => ({
        ...idea,
        x1: (idea.x1 - x1_min) / (x1_max - x1_min),
        y1: (idea.y1 - y1_min) / (y1_max - y1_min),
      }));

      $ideaRelations = $ideaRelations.map((r) => ({
        ...r,
        parent_idea: $ideas.find((i) => i.id == r.parent),
        child_idea: $ideas.find((i) => i.id == r.child),
      }));

      $shownIdeas = $ideas;

      // Set global load state
      $loading = false;
    }
  });
</script>
