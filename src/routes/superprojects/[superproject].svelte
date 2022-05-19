<script>
  import { page } from "$app/stores";
  console.log(page);
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import supabase from "$lib/db";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
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
    currentSuperproject = {};

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
    ] = await Promise.all([
      getTable("ideas"),
      getTable("superprojects"),
      getTable("categories"),
      getTable("problems"),
      getTable("idea_category_relation"),
      getTable("idea_superproject_relation"),
      getTable("idea_problem_relation"),
      getTable("idea_idea_relation"),
    ]);
    let endTime = performance.now();

    console.log(`Time to load data: ${endTime - startTime}ms`);

    ideas.forEach((idea) => {
      idea.categories = categoryRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.superprojects = superprojectRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.problems = problemRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.ideas = ideaRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.categories.forEach((category) => {
        category.category = categories.find(
          (cat) => cat.id === category.category
        );
      });
      idea.superprojects.forEach((superproject) => {
        superproject.superproject = superprojects.find(
          (sp) => sp.id === superproject.superproject
        );
      });
      idea.problems.forEach((problem) => {
        problem.problem = problems.find((p) => p.title === problem.problem);
      });
      idea.shown = true;
    });
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
  });

  const getTable = async (table_name, grabTitle = true) => {
    try {
      let { data, error } = await supabase.from(table_name).select("*");
      return data.map((elm) => ({
        ...elm,
        value: grabTitle ? elm.title : "",
        label: grabTitle ? elm.title : "",
      }));
    } catch (err) {
      console.log(err);
    }
  };
</script>

<Nav />

<div>
  {@html currentSuperproject.authors
    ? markdown(currentSuperproject.authors)
    : ""}
  <h1>{currentSuperproject.title}</h1>
  {@html markdown(currentSuperproject.description)}

  {#each shownIdeas as idea}
    <Idea {idea} />
  {/each}
</div>

<style>
  div {
    margin: 50px auto;
    margin-bottom: 100px;
    max-width: 800px;
  }
  div > h1 {
    margin-top: 0;
  }
</style>
