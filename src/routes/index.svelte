<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [];

  let currentIdea = {};
  let canClick = false;

  let selectedCategories = [];

  let shownIdeas = [];

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
      getTable("idea_superprojects"),
      getTable("idea_categories"),
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
      idea.shown = true;
    });

    canClick = true;
    shownIdeas = ideas;
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

  const selectCategory = (category) => {
    if (canClick) {
      if (selectedCategories.includes(category)) {
        selectedCategories.splice(selectedCategories.indexOf(category), 1);
        selectedCategories = selectedCategories;
      } else {
        selectedCategories = [...selectedCategories, category];
      }

      categories.forEach((elm) => {
        elm.selected = selectedCategories.includes(elm.title);
      });
      categories = categories;

      // Filter which ideas are shown based on selectedCategories
      ideas.forEach((idea) => {
        if (
          idea.categories.find((category) => {
            return selectedCategories.includes(category.category.title);
          }) ||
          selectedCategories.length === 0
        ) {
          idea.shown = true;
        } else {
          idea.shown = false;
        }
      });

      shownIdeas = ideas.filter((idea) => idea.shown);
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };
</script>

<header id="nav" class="sticky-nav">
  <nav class="container w-container">
    <ul role="list" class="nav-grid w-list-unstyled">
      <li class="list-item">
        <a href="/" aria-current="page" class="nav-logo-link w--current">
          <img
            title="Navigate to front page"
            src="images/ideas_icon.png"
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
    </ul>
  </nav>
</header>

{#if canClick}
  <div class="container w-container">
    <div class="ideas-col">
      <div class="idea-categories-wrapper">
        {#each categories as cat, i}
          <div
            class="idea-category filter {cat.selected ? 'selected' : ''}"
            use:tippy={{
              content: `<div class='tooltip'><h5>${cat.title}</h5>${
                cat.tooltip !== null ? `<p>${markdown(cat.tooltip)}</p>` : ""
              }<p><i>Click to filter ideas for this category</i></p></div>`,
              allowHTML: true,
              delay: [1000, 0],
            }}
            on:click={() => {
              selectCategory(cat.title);
            }}
          >
            {cat.title}
          </div>
        {/each}
      </div>

      {#if canClick}
        {#each shownIdeas as idea}
          <div class="idea-card" on:mousedown={() => selectIdea(idea)}>
            <div class="idea-top">
              <div class="idea-superprojects-wrapper list-item">
                <div class="idea-author">
                  {idea.author}
                </div>
                {#if idea.superprojects[0]}
                  {#each idea.superprojects as superproject}
                    <div
                      class="idea-superproject list-item"
                      use:tippy={{
                        content: `<div class='tooltip'><h4>${
                          superproject.superproject.title
                        }</h4>${markdown(
                          superproject.superproject.description
                        )}<p><i>Click to see more ideas</i></p></div>`,
                        allowHTML: true,
                        interactive: true,
                        delay: [500, 0],
                      }}
                    >
                      <img src="images/arrow-up.svg" alt="arrow" />
                      {superproject.superproject.title}
                    </div>
                  {/each}
                {/if}
              </div>
              <div class="idea-icons">
                {#if idea.contact}
                  <a
                    href="mailto:{idea.contact}"
                    use:tippy={{
                      content: `Email the author: ${idea.contact}`,
                      allowHTML: true,
                    }}
                  >
                    <img src="images/at.svg" alt="Send email to author icon" />
                  </a>
                {/if}
                {#if idea.sourced}
                  <a
                    href={idea.sourced}
                    target="_blank"
                    use:tippy={{
                      content: `View the source of this idea`,
                      allowHTML: true,
                    }}
                  >
                    <img src="images/link.svg" alt="Source link icon" />
                  </a>
                {/if}
                {#if idea.verified_by_expert}
                  <div
                    use:tippy={{
                      content: `This idea has been verified by ${
                        !idea.verifier ? "an expert" : idea.verifier
                      }`,
                      allowHTML: true,
                    }}
                  >
                    <img
                      src="images/checkmark.svg"
                      alt="Expert verified icon"
                    />
                  </div>
                {/if}
              </div>
            </div>
            <h3 class="idea-title">{idea.title}</h3>
            <!-- <div class="idea-text">
          {@html markdown(idea.summary)}
        </div> -->
            {#if idea.categories[0]}
              <div class="idea-categories-wrapper list-item">
                {#each idea.categories as cat, i}
                  <div
                    class="idea-category list-item"
                    use:tippy={{
                      content: `<div class='tooltip'><h5>${
                        cat.category.title
                      }</h5>${
                        cat.category.tooltip !== null
                          ? `<p>${markdown(cat.category.tooltip)}</p>`
                          : ""
                      }<p><i>Click to see more ideas in this category</i></p></div>`,
                      allowHTML: true,
                      delay: [1000, 0],
                    }}
                  >
                    {cat.category.title}
                  </div>
                  {#if i < idea.categories.length - 1}
                    <div class="idea-category-separator">·</div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <p>No ideas found</p>
        {/each}
      {/if}
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
            {#each currentIdea.categories as cat}
              <div
                class="idea-category"
                use:tippy={{
                  content: `<div class='tooltip'><h5>${
                    cat.category.title
                  }</h5>${
                    cat.category.tooltip !== null
                      ? `<p>${markdown(cat.category.tooltip)}</p>`
                      : ""
                  }<p><i>Click to see more ideas in this category</i></p></div>`,
                  allowHTML: true,
                  delay: [1000, 0],
                }}
              >
                {cat.category.title}
              </div>
            {/each}
          </div>
        {/if}
        {#if currentIdea.superprojects[0]}
          <h4>
            Superproject{currentIdea.superprojects.length > 1 ? "s" : ""}
          </h4>
          <div class="idea-superprojects-wrapper">
            {#each currentIdea.superprojects as superproject}
              <div
                class="idea-superproject"
                use:tippy={{
                  content: `<div class='tooltip'><h4>${
                    superproject.superproject.title
                  }</h4>${markdown(
                    superproject.superproject.description
                  )}<p><i>Click to see more ideas</i></p></div>`,
                  allowHTML: true,
                  interactive: true,
                  delay: [500, 0],
                }}
              >
                {superproject.superproject.title}
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <h3>Select an idea</h3>
      {/if}
    </div>
  </div>
{:else}
  <div class="loading-wrapper">
    <img src="images/load_icon.png" alt="Loading icon" class="loading-icon" />
    <p>Loading...</p>
  </div>
{/if}

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
    align-items: start;
    margin-bottom: -0.2em;
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
    border: 0;
    padding: 0;
    vertical-align: bottom;
    margin-right: 0.6em;
    margin-top: 0.1em;
  }

  .idea-title {
    font-size: 0.8em;
    line-height: 1em;
    margin: 5px 0 5px 0;
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
    flex-grow: 2000;
    justify-content: start;
    align-items: center;
  }

  .idea-categories-wrapper.list-item {
    opacity: 0.75;
    font-style: italic;
    margin-left: -0.1em;
  }

  .idea-category-separator {
    margin: 0 0.1em 0.1em 0;
    line-height: 0.8em;
  }

  .current-idea-author {
    margin-bottom: 4px;
    line-height: 1em;
  }

  .current-idea-title {
    margin-top: 0;
    margin-bottom: 0.14em;
  }

  .idea-category {
    /* Styling for a tag */
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    padding: 0.2em 0.5em;
    margin-right: 0.4em;
    margin-bottom: 0.3em;
    font-size: 0.8em;
    line-height: 1em;
  }

  .idea-category.filter.selected {
    /* Make background green */
    background-color: #44ff98;
  }

  .idea-category.filter {
    background-color: #fff;
  }

  .idea-category.list-item {
    margin: 0;
    margin-right: 2px;
    padding: 2px;
    font-size: 0.7em;
    line-height: 1em;
    background-color: transparent;
    border: none;
  }

  .idea-category:hover {
    opacity: 0.75;
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

  .idea-superprojects-wrapper.list-item {
    margin: 0;
  }

  .idea-superproject {
    /* Styling for a tag */
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    vertical-align: bottom;

    padding: 0.2em 0.5em;
    margin-right: 0.4em;
    margin-bottom: 0.5em;
    font-size: 0.8em;
    line-height: 1em;
  }

  .idea-superproject.list-item {
    border: 0;
    padding: 0;
    margin: 0;
    font-size: 0.7em;
    line-height: 0.8em;
    border-radius: 0;
    margin-right: 4px;
    background-color: transparent;
  }

  .idea-superproject > img {
    width: 0.7em;
    height: 0.7em;
    margin: 0;
    padding: 0;
    margin-bottom: 0.4em;
  }

  .idea-superproject:hover {
    opacity: 0.75;
    cursor: pointer;
  }

  :global(.tooltip a) {
    text-decoration: none;
    color: #44ff98;
  }

  .loading-icon {
    margin: 0 auto;
    margin-top: 20px;
    margin-bottom: 20px;
    width: 5em;
    height: 5em;
    /* Rotate continusously */
    -webkit-animation: spin 1.1s ease-in-out infinite;
  }

  .loading-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  :global(a) {
    text-decoration: none;
    color: #02da6e;
  }

  :global(a:hover) {
    text-decoration: underline;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f7f7f7;
  }
</style>
