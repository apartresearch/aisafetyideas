<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import Nav from "$lib//Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Footer from "$lib/Footer.svelte";
  import Search from "svelte-search";
  import Select from "svelte-select";

  let url = ``,
    ideaParam = "",
    categoryParam = "";
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
    shownIdeas = [],
    searchIdeas = [],
    comments = [];

  let visible = false,
    searchValue = "";

  onMount(async () => {
    // Create event listener to listen for back button clicks
    window.addEventListener("popstate", () => {
      updateFromUrl();
    });

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
      idea.comments = comments.filter((comment) => comment.idea === idea.id);
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

    loaded = true;
    shownIdeas = ideas;
    updateFromUrl();
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
      setVisible(true);
      url.searchParams.set("idea", idea.id);
      window.history.pushState(null, document, url.href);
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };

  const setVisible = (bowl) => {
    visible = bowl;
    url.searchParams.delete("idea");
    window.history.pushState(null, document, url.href);
  };

  const selectCategory = (category) => {
    if (loaded) {
      if (selectedCategories.includes(category)) {
        selectedCategories.splice(selectedCategories.indexOf(category), 1);
        selectedCategories = selectedCategories;
      } else {
        selectedCategories = [...selectedCategories, category];
      }

      url.searchParams.set("categories", selectedCategories.join(","));
      if (selectedCategories.join(",").length < 1) {
        url.searchParams.delete("categories");
      }
      window.history.pushState(null, document, url.href);

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

  const updateFromUrl = () => {
    url = new URL(window.location.href);
    ideaParam = url.searchParams.get("idea");
    categoryParam = url.searchParams.get("categories");

    if (ideaParam) {
      selectIdea(ideas.find((idea) => idea.id == ideaParam));
      if (!currentIdea) {
        currentIdea = {};
      }
    }

    if (categoryParam) {
      categoryParam = categoryParam.split(",");
      categoryParam.forEach((title) => {
        if (categories.find((cat) => cat.title == title)) selectCategory(title);
      });
    }
    if (
      categoryParam &&
      categories.find((category) => category.id == categoryParam)
    ) {
      selectCategory(categories.find((cat) => cat.id == categoryParam).title);
    }

    if (!ideaParam && !categoryParam) {
      setVisible(false);
    }
  };

  // Holds table sort state.  Initialized to reflect table sorted by id column ascending.
  let sortBy = { col: "id", ascending: false };
  const sort = (column) => {
    console.log(column, column.value);
    column = column.value;
    if (sortBy.col == column) {
      sortBy.ascending = !sortBy.ascending;
    } else {
      sortBy.col = column;
      sortBy.ascending = true;
    }

    // Modifier to sorting function for ascending or descending
    let sortModifier = sortBy.ascending ? 1 : -1;

    // Sort shownIdeas based on sortBy col
    shownIdeas = shownIdeas.sort((a, b) => {
      if (a[sortBy.col] < b[sortBy.col]) return -1 * sortModifier;
      if (a[sortBy.col] > b[sortBy.col]) return 1 * sortModifier;
      return 0;
    });
  };

  $: {
    searchFilter(searchValue);
  }

  const searchFilter = (query) => {
    // Search through the shownIdeas with the query
    searchIdeas = shownIdeas.filter((idea) => {
      return (
        String(idea.title)
          .toLowerCase()
          .includes(String(query).toLowerCase()) ||
        String(idea.description)
          .toLowerCase()
          .includes(String(query).toLowerCase()) ||
        String(idea.author).toLowerCase().includes(String(query).toLowerCase())
      );
    });
  };

  let sortingColumns = [
      { label: "ID", value: "id" },
      { label: "Title", value: "title" },
      { label: "Author", value: "author" },
    ],
    currentSort = "";
</script>

<Nav />

<div class="container w-container">
  <a class="page-author" href="https://apartresearch.com">Apart Research</a>
  <h1 class="page-title">The AI Safety & Governance Ideas Directory</h1>
  <p>
    This is a directory of AI safety and governance ideas. The ideas are
    shovel-ready for development and are linked to categories and superprojects
    (aka agendas).
  </p>
  <div class="search-sort">
    <div class="search">
      <Search bind:value={searchValue} hideLabel />
      {#if searchValue}
        <button on:click={() => (searchValue = "")}
          >Clear "{searchValue}"</button
        >
      {/if}
    </div>
    <div class="sort">
      <Select
        placeholder="Sort by"
        items={sortingColumns}
        bind:value={currentSort}
        on:select={sort(currentSort)}
      />
    </div>
  </div>

  {#if loaded}
    <div class="ideas-col">
      <div class="idea-categories-wrapper">
        {#each categories as cat, i}
          <CategoryTag
            {cat}
            {selectCategory}
            filter={true}
            selected={cat.selected}
          />
        {/each}
      </div>

      {#if loaded}
        {#if searchValue}
          {#each searchIdeas as idea}
            <Idea {idea} {selectIdea} {selectCategory} />
          {:else}
            <p class="not-found">No ideas found</p>
          {/each}
        {:else}
          {#each shownIdeas as idea}
            <Idea {idea} {selectIdea} {selectCategory} />
          {:else}
            <p class="not-found">No ideas found</p>
          {/each}
        {/if}
      {/if}
    </div>
  {:else}
    <LoadIcon />
  {/if}
  <IdeaViewer idea={currentIdea} {visible} {setVisible} />
</div>

<Footer />

<style>
  :global([data-svelte-search] input) {
    width: 100%;
    font-size: 1rem;
    padding: 0.5rem;
    border: 1px solid #e0e0e0;
    border-radius: 0.25rem;
    height: 2.65em;
  }

  :global([data-svelte-search] input:focus) {
    outline: none;

    border: 1px solid #02da6e;
  }

  .not-found {
    font-size: 1.5rem;
    text-align: center;
    margin: auto;
    margin-top: 2rem;
    color: #999;
    font-style: italic;
  }

  .container {
    margin: 75px auto;
    margin-bottom: 125px;
    max-width: 800px;
    min-height: 800px;
  }

  .ideas-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    margin-bottom: 20px;
    left: 0;
  }

  .idea-categories-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
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

  .page-author {
    font-size: 0.8em;
    color: #000;
  }

  .page-title {
    font-size: 1.5em;
    line-height: 1.2em;
    font-weight: bold;
    margin: 5px 0;
  }

  .search-sort {
    display: flex;
    flex-direction: row;
    margin: 0;
    padding: 0;
    margin-top: -0.2em;
    margin-bottom: 0.2em;
  }

  .search-sort > div {
    padding: 0;
    flex-grow: 1;
    font-size: 0.7em;
    line-height: 1em;

    --border: 1px solid #e0e0e0;
    --borderRadius: 0.2rem;
    --placeholderColor: #999;
    --borderFocusColor: #02da6e;
    --itemIsActiveBG: #02da6e;
    --itemHoverBG: #02da6e13;
    --internalPadding: 0.2em;
  }

  .search {
    width: 69%;
  }

  .sort {
    width: 30%;
    margin-left: 1%;
  }

  /* mobile style */
  @media (max-width: 768px) {
    .idea-categories-wrapper {
      flex-wrap: nowrap;
      overflow: auto;
    }

    .container {
      padding: 0 10px;
    }
  }
</style>
