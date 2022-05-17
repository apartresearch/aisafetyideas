<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import SvelteTooltip from "svelte-tooltip";

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [];

  $: currentIdea = {};

  let canClick = false;

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

    currentIdea = ideas[ideas.length - 1];

    console.table(categories);
    console.table(superprojects);
    console.table(problems);
    console.table(categoryRelations);

    console.table(ideas);

    canClick = true;
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
    if (canClick) {
      currentIdea = idea;
    } else {
      console.log("Cannot click before it has loaded.");
    }
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
        <div class="idea-top">
          <p class="idea-author">{idea.author}</p>
          <div class="idea-icons">
            {#if idea.contact}
              <a
                href="mailto:{idea.contact}"
                title="Write to the author: {idea.contact}"
              >
                <img src="images/at.svg" alt="Send email to author icon" />
              </a>
            {/if}
            {#if idea.sourced}
              <a
                href={idea.sourced}
                target="_blank"
                title="Found elsewhere; click to view the source"
              >
                <img src="images/link.svg" alt="Source link icon" />
              </a>
            {/if}
            {#if idea.verified_by_expert}
              <div
                title="Verified by {!idea.verifier
                  ? 'an expert'
                  : idea.verifier}"
              >
                <img src="images/checkmark.svg" alt="Expert verified icon" />
              </div>
            {/if}
          </div>
        </div>
        <h3 class="idea-title">{idea.title}</h3>
        <!-- <div class="idea-text">
          {@html markdown(idea.summary)}
        </div> -->
        {#if "categories" in idea}
          DUCKs
          <div class="idea-categories-wrapper">
            {#each idea.categories as cat}
              <div class="idea-category" title={cat.category.tooltip}>
                {cat.category.title}
              </div>
            {/each}
          </div>
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
      <p class="current-idea-author">{currentIdea.author}</p>
      <h2 class="current-idea-title">{currentIdea.title}</h2>
      <div class="current-idea-text">
        {@html markdown(currentIdea.summary)}
      </div>
      {#if currentIdea.categories[0]}
        <h4>Categories</h4>
        <div class="idea-categories-wrapper">
          {#each currentIdea.categories as category}
            <div class="idea-category" title={category.category.tooltip}>
              {category.category.title}
            </div>
          {/each}
        </div>
      {/if}
      {#if currentIdea.superprojects[0]}
        <h4>Superprojects</h4>
        <div class="idea-superprojects-wrapper">
          {#each currentIdea.superprojects as superproject}
            <div class="idea-superproject">
              {superproject.superproject.title}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <h3>Loading...</h3>
    {/if}
  </div>
</div>

<style>
  .idea-card {
    background-color: #fff;
    padding: 7px 10px;
    margin: 0;
    border-right: 2px solid #f9f9f9;
    border-bottom: 2px solid #f9f9f9;
    width: 100%;
  }

  .idea-card:hover {
    background-color: #fafafa;
    cursor: pointer;
  }

  .idea-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: -3px;
  }

  .idea-icons {
    display: flex;
    align-items: right;
    font-size: 0.7em;
    line-height: 0.8em;
  }

  .idea-icons * {
    margin: 0;
    margin-left: 0.1em;
    cursor: pointer;
    text-decoration: none;
  }

  .idea-icons > * > * {
    margin: 0;
    height: 1.4em;
  }

  .idea-icons *:hover {
    opacity: 0.75;
  }

  .idea-author {
    font-size: 0.7em;
    line-height: 0.8em;
    margin-bottom: 4px;
    opacity: 0.9;
  }

  .idea-title {
    font-size: 0.8em;
    line-height: 1em;
    margin: 0;
    margin-bottom: 4px;
  }

  .idea-text {
    font-size: 0.7em;
    line-height: 1.2em;
  }

  .container {
    display: flex;
    flex-direction: row;
    justify-content: start;
    max-width: 1100px;
  }

  .ideas-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    margin-bottom: 20px;
    width: 50%;
    left: 0;
  }

  .current-idea-col {
    display: flex;
    flex-direction: column;
    justify-content: top;
    align-items: top;
    margin-bottom: 20px;
    position: fixed;
    left: 50%;
    width: 50%;
    max-width: 550px;
    padding: 20px;
    background-color: #fff;
    height: 100vh;
  }

  .idea-categories-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
  }

  .current-idea-author {
    margin-bottom: 4px;
    line-height: 1em;
  }

  .current-idea-title {
    margin-top: 0;
  }

  .idea-category {
    /* Styling for a tag */
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    border-radius: 5px;
    padding: 2px 5px;
    margin-right: 5px;
    margin-bottom: 5px;
    font-size: 0.7em;
    line-height: 1em;
  }

  .idea-category:hover {
    background-color: #fafafa;
    cursor: pointer;
  }

  .idea-superprojects-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
    margin-bottom: 10px;
  }

  .idea-superproject {
    /* Styling for a tag */
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    border-radius: 5px;
    padding: 2px 5px;
    margin-right: 5px;
    margin-bottom: 5px;
    font-size: 0.7em;
    line-height: 1em;
  }

  .idea-superproject:hover {
    background-color: #fafafa;
    cursor: pointer;
  }
</style>
