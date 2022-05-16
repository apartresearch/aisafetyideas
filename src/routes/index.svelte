<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import Tooltip from "../lib/Tooltip.svelte";
  import { tooltip } from "../lib/tooltip";

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [];

  $: currentIdea = {};

  onMount(async () => {
    ideas = await getTable("ideas");
    superprojects = await getTable("idea_superprojects");
    categories = await getTable("idea_categories");
    problems = await getTable("problems");
    categoryRelations = await getTable("idea_category_relation", false);
    superprojectRelations = await getTable("idea_superproject_relation", false);
    problemRelations = await getTable("idea_problem_relation", false);
    ideaRelations = await getTable("idea_idea_relation", false);

    ideas.forEach((idea) => {
      idea.categories = categoryRelations.filter(
        (relation) => relation.idea_id === idea.id
      );
      idea.superprojects = superprojectRelations.filter(
        (relation) => relation.idea_id === idea.id
      );
      idea.problems = problemRelations.filter(
        (relation) => relation.idea_id === idea.id
      );
      idea.ideas = ideaRelations.filter(
        (relation) => relation.idea_id === idea.id
      );

      idea.categories.forEach((category) => {
        category.category = categories.find(
          (cat) => cat.title === category.category
        );
      });

      idea.superprojects.forEach((superproject) => {
        superproject.superproject = superprojects.find(
          (sp) => sp.title === superproject.superproject
        );
      });

      idea.problems.forEach((problem) => {
        problem.problem = problems.find((p) => p.title === problem.problem);
      });
    });

    currentIdea = ideas[0];
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

  const selectIdea = (idea) => {
    currentIdea = idea;
    console.log(currentIdea);
  };
</script>

<svelte:head>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f7f7f7;
    }
  </style>
</svelte:head>

<header id="nav" class="sticky-nav">
  <nav class="container w-container">
    <ul role="list" class="nav-grid w-list-unstyled">
      <li class="list-item">
        <a href="/" aria-current="page" class="nav-logo-link w--current">
          <img
            title="Navigate to front page"
            src="https://uploads-ssl.webflow.com/622160bba1d5c0dcf96f8bdf/62431292c50af756943fd210_ideas_icon.png"
            alt="AI safety ideas logo"
            class="nav-logo"
            use:tooltip
          />
        </a>
        <h1 class="logotext">AI Safety Research Ideas</h1>
      </li>
      <li id="w-node-_8db6f7ee-7804-6955-cbb7-65390522c9f3-81dce09d">
        <div class="html-embed w-embed">
          <button
            data-tally-open="mZqqAn"
            data-tally-hide-title="1"
            href="backend"
            class="button utility w-button"
          >
            Submit an idea
          </button>
        </div>
      </li>
      <li><a href="#" class="button utility w-button"> Dark mode </a></li>
    </ul>
  </nav>
</header>
<div class="container w-container">
  <div class="ideas-col">
    {#each ideas as idea}
      <div class="idea-card" on:mousedown={() => selectIdea(idea)}>
        <p class="idea-author">{idea.author}</p>
        <h3 class="idea-title">{idea.title}</h3>
        <div class="idea-text">
          {@html markdown(idea.summary)}
        </div>
        {#if idea.categories}
          {#each idea.categories as category}
            <div
              class="idea-category"
              title={category.category.tooltip}
              use:tooltip
            >
              {category.category.title}
            </div>
          {/each}
        {/if}
        {#if idea.superprojects}
          {#each idea.superprojects as superproject}
            <div class="idea-superproject">
              {superproject.superproject.title}
            </div>
          {/each}
        {/if}
      </div>
    {:else}
      <p>No ideas found</p>
    {/each}
  </div>
  <div class="current-idea-col">
    {#if currentIdea.title}
      <p class="idea-author">{currentIdea.author}</p>
      <h2>{currentIdea.title}</h2>
      <div class="current-idea-text">
        {@html markdown(currentIdea.summary)}
      </div>
      <div>
        {#if currentIdea.categories}
          {#each currentIdea.categories as category}
            <div
              class="idea-category"
              title={category.category.tooltip}
              use:tooltip
            >
              {category.category.title}
            </div>
          {/each}
        {/if}
      </div>
    {:else}
      <h3>No idea selected...</h3>
    {/if}
  </div>
</div>

<style>
  .idea-card {
    background-color: #fff;
    border-radius: 5px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .idea-card:hover {
    background-color: #fafafa;
    cursor: pointer;
  }

  .idea-author {
    font-size: 0.8em;
    line-height: 1em;
    font-style: italic;
    margin-bottom: 4px;
  }

  .idea-title {
    font-size: 1.2em;
    line-height: 1.2em;
    margin: 0;
    margin-bottom: 4px;
  }

  .idea-text {
    font-size: 0.8em;
  }

  .container {
    display: flex;
    flex-direction: row;
    justify-content: start;
  }

  .ideas-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin-bottom: 20px;
    width: 50%;
    left: 0;
    padding-right: 20px;
  }

  .current-idea-col {
    display: flex;
    flex-direction: column;
    justify-content: top;
    align-items: top;
    margin-bottom: 20px;
    width: 50%;
    position: fixed;
    right: 0;
  }
</style>
