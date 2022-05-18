<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  import Nav from "../lib//Nav.svelte";
  import Idea from "../lib/Idea.svelte";

  let url = ``,
    ideaParam = "";
  // console.log($page.url.searchParams.has("meme"));

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [],
    currentIdea = {},
    loaded = false,
    selectedCategories = [],
    shownIdeas = [];

  onMount(async () => {
    url = new URL(window.location.href);
    ideaParam = url.searchParams.get("idea");
    console.log("Idea:", ideaParam);

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

    loaded = true;
    shownIdeas = ideas;
    if (ideaParam) {
      currentIdea = ideas.find((idea) => idea.id == ideaParam);
      if (!currentIdea) {
        currentIdea = {};
      }
    }
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
    if (loaded) {
      currentIdea = idea;
      url.searchParams.set("idea", idea.id);
      window.history.pushState(null, document, url.href);
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };

  const selectCategory = (category) => {
    if (loaded) {
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

<Nav />

{#if loaded}
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

      {#if loaded}
        {#each shownIdeas as idea}
          <Idea {idea} {selectIdea} />
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
                  }</div>`,
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
    flex-grow: 1;
    text-align: center;
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

  .idea-superproject:hover {
    opacity: 0.75;
    cursor: pointer;
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
  :global(.tooltip a) {
    text-decoration: none;
    color: #44ff98;
  }
  :global(.tooltip a:hover) {
    text-decoration: underline;
  }
</style>
