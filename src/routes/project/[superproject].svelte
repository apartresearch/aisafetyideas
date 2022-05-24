<script>
  import { supabase, getTable, setupIdeas } from "$lib/db";
  import { page } from "$app/stores";
  console.log(page);
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  const superprojectSlug = $page.params.superproject;

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [],
    currentIdea = {},
    canClick = false,
    selectedCategories = [],
    shownIdeas = [],
    currentSuperproject = {},
    comments = [];

  let visible = false,
    loading = true;

  onMount(async () => {
    let startTime = performance.now();
    [
      ideas,
      superprojects,
      categories,
      problems,
      categoryRelations,
      superprojectRelations,
      problemRelations,
      ideaRelations,
      comments,
    ] = await Promise.all([
      getTable("ideas"),
      getTable("superprojects"),
      getTable("categories"),
      getTable("problems"),
      getTable("idea_category_relation"),
      getTable("idea_superproject_relation"),
      getTable("idea_problem_relation"),
      getTable("idea_idea_relation"),
      getTable("comments"),
    ]);
    let endTime = performance.now();

    console.log(`Time to load data: ${endTime - startTime}ms`);

    ideas = setupIdeas(
      ideas,
      superprojects,
      categories,
      problems,
      categoryRelations,
      superprojectRelations,
      problemRelations,
      ideaRelations,
      comments
    );

    shownIdeas = ideas;

    canClick = true;
    currentSuperproject = superprojects.find(
      (superproject) => superproject.slug === superprojectSlug
    );

    shownIdeas = ideas.filter((idea) =>
      idea.superprojects.find(
        (superproject) => superproject.superproject.slug === superprojectSlug
      )
    );

    loading = false;
  });

  const selectIdea = (idea) => {
    if (!canClick) return;
    currentIdea = idea;
    setVisible(true);
  };

  const setVisible = (bowl) => {
    if (!canClick) return;
    visible = bowl;
  };

  const addComment = async (comment) => {
    if (currentIdea) {
      shownIdeas[
        shownIdeas.findIndex((idea) => idea.id == currentIdea.id)
      ].comments_n += 1;
      shownIdeas = shownIdeas;
      await supabase.from("comments").insert(comment);
    }
  };
</script>

<Nav />

{#if loading}
  <LoadIcon />
{:else}
  <div>
    {@html currentSuperproject.authors
      ? markdown(currentSuperproject.authors)
      : ""}
    <h1>{currentSuperproject.title}</h1>
    {@html markdown(currentSuperproject.description)}

    {#each shownIdeas as idea}
      <Idea {idea} {selectIdea} />
    {/each}
  </div>

  <IdeaViewer idea={currentIdea} {visible} {setVisible} {addComment} />
{/if}

<style>
  :global(body) {
    background-color: #f7f7f7;
  }
  div {
    margin: 80px auto;
    margin-bottom: 100px;
    max-width: 800px;
  }
  div > h1 {
    margin-top: 0;
  }
</style>
