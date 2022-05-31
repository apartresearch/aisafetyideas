<script>
  import { supabase, getTable, setupIdeas, getComments } from "$lib/db";
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
    categoryParam = "",
    sortParam = "";
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
      getIdeas(),
      getTable("superprojects"),
      getTable("categories"),
      getTable("problems"),
      getTable("idea_category_relation"),
      getTable("idea_superproject_relation"),
      getTable("idea_problem_relation"),
      getTable("idea_idea_relation"),
      getComments(),
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

    loaded = true;
    shownIdeas = ideas;
    updateFromUrl();
  });

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
      sort("Amount of comments");
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };

  const shuffle = (array) => {
    let currentIndex = array.length,
      randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  };

  const updateFromUrl = () => {
    url = new URL(window.location.href);
    ideaParam = url.searchParams.get("idea");
    categoryParam = url.searchParams.get("categories");
    currentSort = url.searchParams.get("sort");

    if (currentSort) {
      sort({ value: currentSort });
    }

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
    column = column.value;
    url.searchParams.set("sort", column);
    window.history.pushState(null, document, url.href);
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
      if (!a[sortBy.col]) return 1 * sortModifier;
      if (!b[sortBy.col]) return -1 * sortModifier;
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
        String(idea.summary)
          .toLowerCase()
          .includes(String(query).toLowerCase()) ||
        String(idea.author).toLowerCase().includes(String(query).toLowerCase())
      );
    });
  };

  let sortingColumns = [
      { label: "Difficulty", value: "difficulty" },
      { label: "Amount of comments", value: "comments_n" },
      { label: "Contact available", value: "contact" },
      { label: "Author", value: "author" },
      { label: "Title", value: "title" },
      { label: "ID", value: "id" },
      { label: "Created on", value: "created_at" },
      { label: "Sourced on", value: "from_date" },
      { label: "Mentorship available", value: "mentorship_from" },
      { label: "Funding available", value: "funding_amount" },
    ],
    currentSort = "";

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

<svelte:head>
  <title>{visible ? currentIdea.title + " | " : ""}AI Safety Ideas</title>
</svelte:head>

<Nav />

<div class="container w-container">
  <div class="search-sort">
    <div class="search">
      {#if searchValue}
        <button on:click={() => (searchValue = "")}> Clear search </button>
      {/if}
      <Search bind:value={searchValue} hideLabel />
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
  <IdeaViewer idea={currentIdea} {visible} {setVisible} {addComment} />
</div>

<Footer />

<style>
  :global([data-svelte-search] input) {
    width: 100%;
    font-size: 1rem;
    padding: 0.5rem;
    border: 1px solid var(--light-accent-border);
    border-radius: 0.25rem;
    height: 2.65em;
  }

  :global([data-svelte-search] input:focus) {
    outline: none;

    border: 1px solid var(--primary-color);
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
    margin: 1em auto;
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
    /* flex-wrap: wrap; */
    overflow: auto;

    justify-content: start;
    align-items: center;
  }

  :global(a) {
    text-decoration: none;
    color: var(--link-color);
  }

  :global(a:hover) {
    text-decoration: underline;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: var(--bg-color-light);
  }
  :global(.tooltip a) {
    text-decoration: none;
    color: var(--link-color);
  }

  :global(.tooltip a:hover) {
    text-decoration: underline;
  }

  .search-sort {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
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
    --borderFocusColor: var(--primary-color);
    --itemIsActiveBG: var(--primary-color);
    --itemHoverBG: var(--primary-color-hover);
    --internalPadding: 0.2em;
  }

  .search {
    width: 69%;
  }

  .sort {
    width: 30%;
    margin-left: 1%;
  }

  /* width */
  ::-webkit-scrollbar {
    width: 0.35em;
    height: 0.35em;
  }

  /* Track */
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    background: #dedede;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background: #cdcdcd;
  }

  /* mobile style */
  @media (max-width: 768px) {
    .idea-categories-wrapper {
      flex-wrap: nowrap;
      overflow: auto;
    }

    .container {
      padding: 0 10px;
      margin: 1em 0;
    }

    .search-sort {
      flex-direction: column;
    }

    .search-sort > div {
      width: 100%;
      margin-top: 0.25em;
    }
  }
</style>
