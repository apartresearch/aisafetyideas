<script>
  import {
    user,
    users,
    superprojects,
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
    superprojectRelations,
    problemRelations,
    ideaRelations,
    loading,
    verifications,
  } from "$lib/stores.js";
  import { onMount } from "svelte";
  import { getTable } from "$lib/db.js";

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
        $superprojects,
        $ideas,
        $comments,
        $categories,
        $problems,
        $idea_likes,
        $fundings,
        $interests,
        $mentorships,
        $categoryRelations,
        $superprojectRelations,
        $problemRelations,
        $ideaRelations,
        $verifications,
      ] = await Promise.all([
        getTable("users"),
        getTable(
          "superprojects",
          true,
          process.env.PROJECT_FACTORY == "TRUE" ? true : false
        ),
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
        getTable("idea_superproject_relation"),
        getTable("idea_problem_relation"),
        getTable("idea_idea_relation"),
        getTable("idea_user_verification_relation"),
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

      //   Setup the ideas
      $ideas = $ideas
        .filter((i) => i.filtered == true)
        .map((idea) => ({
          ...idea,
          likes: $idea_likes.filter((like) => like.idea === idea.id).length,
          user_liked: $idea_likes.find(
            (like) => like.idea === idea.id && $user && like.user === $user.id
          ),
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
          superprojects: $superprojectRelations
            .filter(
              (r) =>
                r.idea === idea.id &&
                $superprojects.some((p) => p.id == r.superproject)
            )
            .map((s) => ({
              ...s,
              superproject: $superprojects.find(
                (sp) => sp.id === s.superproject
              ),
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
          // verifications: $verifications.filter((v) => v.idea === idea.id),
          // verifications_n: $verifications.filter((v) => v.idea === idea.id)
          // .length,
        }));

      $superprojects = $superprojects.map((sp) => ({
        ...sp,
        ideas_n: $superprojectRelations.filter((r) => r.superproject == sp.id)
          .length,
      }));

      $shownIdeas = $ideas;

      console.log(
        "Ideas",
        $ideas,
        "Users",
        $users,
        "Superprojects",
        $superprojects,
        "Idea likes",
        $idea_likes,
        "Idea category relations",
        $categoryRelations,
        "Idea superproject relations",
        $superprojectRelations,
        "Idea problem relations",
        $problemRelations,
        "Idea idea relations",
        $ideaRelations,
        "Comments",
        $comments,
        "Categories",
        $categories,
        "Problems",
        $problems,
        "Fundings",
        $fundings,
        "Interests",
        $interests,
        "Mentorships",
        $mentorships,
        "User",
        $user,
        "Loading",
        $loading,
        "Verifications",
        $verifications
      );

      // Set global load state
      $loading = false;
    }
  });
</script>
