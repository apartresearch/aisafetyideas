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
    });
  });

  const getTable = async (table_name, grabTitle = false) => {
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

<svelte:head>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafafa;
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
  {#each ideas as idea}
    <div class="idea-card">
      <p class="idea-author">{idea.author}</p>
      <h3 class="idea-title">{idea.title}</h3>
      <div class="idea-text">
        {@html markdown(idea.summary)}
      </div>
      {#each idea.categories as category}
        <div class="idea-category">{category.title}</div>
      {/each}
      {#each idea.superprojects as superproject}
        <div class="idea-superproject">{superproject.title}</div>
      {/each}
    </div>
  {:else}
    <p>No ideas found</p>
  {/each}
</div>

<style>
  .idea-card {
    background-color: #fff;
    border-radius: 5px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .idea-author {
    font-size: 0.8em;
    line-height: 1em;
    font-style: italic;
    margin-bottom: 0px;
  }

  .idea-title {
    font-size: 1.2em;
    margin-bottom: 10px;
  }

  .idea-text {
    font-size: 0.8em;
  }
</style>
