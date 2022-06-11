<script>
  import { supabase } from "$lib/db";
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
  import SuperprojectBlock from "$lib/SuperprojectBlock.svelte";
  import MediaQuery from "$lib/MediaQuery.svelte";
  import SubmitBlock from "$lib/SubmitBlock.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import {
    ideas,
    superprojects,
    loading,
    ideaViewVisible,
    ideaCurrent,
    shownIdeas,
    categories,
  } from "$lib/stores.js";
  import { init } from "svelte/internal";

  let url = ``,
    ideaParam = "",
    categoryParam = "",
    sortParam = "";
  // console.log($page.url.searchParams.has("meme"));

  let problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [],
    currentIdea = {},
    selectedCategories = [],
    searchIdeas = [],
    userList = [];

  let searchValue = "";

  onMount(async () => {
    // Create event listener to listen for back button clicks
    window.addEventListener("popstate", () => {
      updateFromUrl();
    });
    initState();
  });

  const initState = () => {
    if ($loading) {
      window.setTimeout(initState, 100);
    } else {
      sort({ label: "Upvotes", value: "likes" });
      updateFromUrl();
    }
  };

  const selectCategory = (category) => {
    if (!$loading) {
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

      $categories.forEach((elm) => {
        elm.selected = selectedCategories.includes(elm.title);
      });
      $categories = $categories;

      // Filter which ideas are shown based on selectedCategories
      $ideas.forEach((idea) => {
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

      $shownIdeas = $ideas.filter((idea) => idea.shown);
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };

  const updateFromUrl = () => {
    url = new URL(window.location.href);
    ideaParam = url.searchParams.get("idea");
    categoryParam = url.searchParams.get("categories");
    let sortParam = url.searchParams.get("sort");

    if (sortParam) {
      if (sortParam != "likes")
        currentSort = sortingColumns.find((elm) => elm.value === sortParam);
    }

    if (ideaParam) {
      $ideaCurrent = $ideas.find((idea) => idea.id == ideaParam);
      $ideaViewVisible = true;
    }

    if (categoryParam) {
      categoryParam = categoryParam.split(",");
      categoryParam.forEach((title) => {
        if ($categories.find((cat) => cat.title == title))
          selectCategory(title);
      });
    }
    if (
      categoryParam &&
      $categories.find((category) => category.id == categoryParam)
    ) {
      selectCategory($categories.find((cat) => cat.id == categoryParam).title);
    }
  };

  // Holds table sort state.  Initialized to reflect table sorted by id column ascending.
  let sortBy = { col: "", ascending: false };
  const sort = (column) => {
    column = column.value;
    if (url) {
      url.searchParams.set("sort", column);
      window.history.pushState(null, document, url.href);
    }

    if (sortBy.col == column) {
      sortBy.ascending = !sortBy.ascending;
    } else {
      sortBy.col = column;
      sortBy.ascending = false;
    }

    // Modifier to sorting function for ascending or descending
    let sortModifier = sortBy.ascending ? 1 : -1;

    // Sort shownIdeas based on sortBy col
    $shownIdeas = $shownIdeas.sort((a, b) => {
      if (a[sortBy.col] < b[sortBy.col]) return -1 * sortModifier;
      if (a[sortBy.col] > b[sortBy.col]) return 1 * sortModifier;
      if (!a[sortBy.col]) return 1 * sortModifier;
      if (!b[sortBy.col]) return -1 * sortModifier;
      return 0;
    });
  };

  $: {
    searchFilter(searchValue);
  }

  const searchFilter = (query) => {
    // Search through the shownIdeas with the query
    searchIdeas = $shownIdeas.filter((idea) => {
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
      { label: "Upvotes", value: "likes" },
      { label: "Amount of comments", value: "comments_n" },
      { label: "Hours of work", value: "difficulty" },
      { label: "Contact available", value: "contact" },
      { label: "Author", value: "author" },
      { label: "Title", value: "title" },
      { label: "Submitted on", value: "created_at" },
      { label: "Sourced on", value: "from_date" },
      { label: "Mentorship available", value: "mentorship_from" },
      { label: "Funding available", value: "funding_amount" },
    ],
    currentSort = { label: "Upvotes", value: "likes" };

  $: {
    sort(currentSort);
  }
</script>

<svelte:head>
  <title>
    {$ideaViewVisible ? $ideaCurrent.title + " | " : ""}AI Safety Ideas
  </title>
</svelte:head>

<DataLoader />
<Nav />
<div class="globwrap">
  <div class="container first">
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
        />
      </div>
    </div>
  </div>
  {#if !$loading}
    <div class="container">
      <div class="ideas-col">
        <div class="idea-categories-wrapper">
          {#each $categories.sort( (a, b) => (a.priority > b.priority ? 1 : -1) ) as cat, i}
            <CategoryTag
              {cat}
              {selectCategory}
              filter={true}
              selected={cat.selected}
            />
          {/each}
        </div>

        {#if searchValue}
          {#each searchIdeas.slice(0, 4) as idea}
            <Idea {idea} {selectCategory} />
          {:else}
            <p class="not-foun d">No ideas found</p>
          {/each}
        {:else}
          {#each $shownIdeas.slice(0, 4) as idea}
            <Idea {idea} {selectCategory} />
          {:else}
            <p class="not-found">No ideas found</p>
          {/each}
        {/if}
      </div>
    </div>
    <div class="intermission">
      <MediaQuery query="(max-width: 768px)" let:matches>
        {#if matches}
          <h2>Projects</h2>
        {/if}
      </MediaQuery>
      <p>
        See all projects <a href="/projects">here</a>. Click on a project to see
        the ideas in each.
      </p>
      <div class="project-contain">
        {#each $superprojects
          .sort(() => Math.random() - 0.5)
          .slice(0, 5) as project}
          <SuperprojectBlock {project} />
        {/each}
      </div>
    </div>
    <div class="container">
      <div class="ideas-col">
        {#if searchValue}
          {#each searchIdeas.slice(4, 8) as idea}
            <Idea {idea} {selectCategory} />
          {/each}
        {:else}
          {#each $shownIdeas.slice(4, 8) as idea}
            <Idea {idea} {selectCategory} />
          {/each}
        {/if}
      </div>
    </div>
    <!-- <div class="intermission">
      <SubmitBlock />
    </div> -->
    <div class="container">
      <div class="ideas-col">
        {#if searchValue}
          {#each searchIdeas.slice(8, searchIdeas.length) as idea}
            <Idea {idea} {selectCategory} />
          {:else}
            <p class="not-found">No ideas found</p>
          {/each}
        {:else}
          {#each $shownIdeas.slice(8, $shownIdeas.length) as idea}
            <Idea {idea} {selectCategory} />
          {:else}
            <p class="not-found">No ideas found</p>
          {/each}
        {/if}
      </div>
    </div>
  {:else}
    <LoadIcon />
  {/if}
  <IdeaViewer />
</div>

<Footer />

<style>
  .project-contain {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: stretch;
    max-width: 1200px;
    column-gap: 0.5rem;
    row-gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .intermission {
    margin: 1rem 0;
  }

  .intermission > h2 {
    text-align: center;
  }

  .globwrap {
    padding-top: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: left;
    align-items: center;
    min-height: 100vh;
  }

  :global([data-svelte-search] input) {
    width: 100%;
    font-size: 1rem;
    padding: 0.5rem;
    border: 1px solid var(--light-accent-border);
    border-radius: var(--border-radius);
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
    margin: 0 auto;
    max-width: 800px;
    width: 100%;
  }

  .container.first {
    z-index: 101;
    margin-top: -3rem;
    border-radius: var(--border-radius);
    padding: 10px 10px 0px 10px;
    max-width: 820px;
    background: var(--bg-color-light);
  }

  .ideas-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    left: 0;
  }

  .idea-categories-wrapper {
    display: flex;
    flex-direction: row;
    /* flex-wrap: wrap; */
    overflow: auto;
    justify-content: start;
    align-items: center;
    padding-bottom: 0.2rem;
  }

  .search-sort {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    margin: 0;
    padding: 0;
    margin-top: -0.2em;
    margin-bottom: 0.2em;
    width: 100%;
  }

  .search-sort > div {
    padding: 0;
    flex-grow: 1;
    font-size: 0.7em;
    line-height: 1em;

    --border: 1px solid #e0e0e0;
    --borderRadius: var(--border-radius);
    --placeholderColor: #999;
    --borderFocusColor: var(--primary-color);
    --itemIsActiveBG: var(--primary-color);
    --itemHoverBG: var(--primary-color-hover);
    --internalPadding: 0.2em;
  }

  .search {
    width: 69.5%;
  }

  .sort {
    width: 30%;
    margin-left: 1%;
  }

  /* width */
  ::-webkit-scrollbar {
    width: 0.35em;
    height: 0.35em;
    border-radius: var(--border-radius);
  }

  /* Track */
  ::-webkit-scrollbar-track {
    border-radius: var(--border-radius);
    background: #f1f1f1;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    border-radius: var(--border-radius);
    background: #dedede;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background: #cdcdcd;
  }

  /* mobile style */
  @media (max-width: 768px) {
    .container.first {
      margin-top: 0;
    }
    .idea-categories-wrapper {
      flex-wrap: nowrap;
      overflow: auto;
    }

    .container {
      padding: 0 0.5rem;
    }

    .search-sort {
      flex-direction: column;
    }

    .search-sort > div {
      width: 100%;
      margin-top: 0.25em;
    }

    .project-contain {
      flex-direction: column;
    }

    .intermission {
      padding: 0 0.5rem;
      text-align: center;
    }
  }
</style>
