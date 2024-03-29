<script>
  import { onMount } from "svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Search from "svelte-search";
  import Select from "svelte-select";
  import moment from "moment";
  import DataLoader from "$lib/DataLoader.svelte";
  import UserLogin from "$lib/UserLogin.svelte";

  import {
    ideas,
    nodes,
    loading,
    ideaViewVisible,
    ideaCurrent,
    shownIdeas,
    categories,
  } from "$lib/stores.js";
  import { init } from "svelte/internal";
  import HeaderManager from "$lib/HeaderManager.svelte";

  let url = "",
    ideaParam = "",
    categoryParam = "",
    sortParam = "";
  // console.log($page.url.searchParams.has("meme"));

  let selectedCategories = [],
    searchIdeas = [],
    switchSort = 1;

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
    if (url.searchParams.get("search"))
      searchValue = url.searchParams.get("search");
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

    if (searchValue) {
      searchFilter(searchValue);
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
    if (!column.value) return null;

    column = column.value;
    if (url) {
      url.searchParams.set("sort", column);
      window.history.pushState(null, document, url.href);
    }

    sortBy.col = column;
    sortBy.ascending = false;

    let dates = false,
      binary = false,
      strings = false;

    if (column == "difficulty" || column == "title") {
      sortBy.ascending = true;
    }
    if (column == "created_at" || column == "from_date") {
      dates = true;
    }
    if (column == "mentorship_from") binary = true;
    if (column == "title" || column == "description") strings = true;

    // Modifier to sorting function for ascending or descending
    let sortModifier = (sortBy.ascending ? 1 : -1) * switchSort;

    // Sort shownIdeas based on sortBy col
    $shownIdeas = $shownIdeas.sort((a, b) => {
      if (binary) {
        // if (a[column] == null) return 1;
        // if (b[column] == null) return -1;
        return (!!a[column] - !!b[column]) * sortModifier;
      } else if (dates) {
        if (a[column] == null) return 1;
        if (b[column] == null) return -1;
        return moment(a[column]).diff(moment(b[column])) * sortModifier;
      } else if (strings) {
        if (a[column] == null) return 1;
        if (b[column] == null) return -1;
        return a[column].localeCompare(b[column]) * sortModifier;
      } else {
        if (a[column] == null || a[column] == 0) return 1;
        if (b[column] == null || b[column] == 0) return -1;
        return (a[column] - b[column]) * sortModifier;
      }
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
    if (url) {
      // console.log("WTF", url, query);
      // if (searchValue == "") url.searchParams.delete("search");
      url.searchParams.set("search", query);
      if (!query) url.searchParams.delete("search");
    }
  };

  let sortingColumns = [
      { label: "Upvotes", value: "likes" },
      { label: "Amount of comments", value: "comments_n" },
      { label: "Hours of work", value: "difficulty" },
      // { label: "Contact available", value: "contact" },
      // { label: "Author", value: "author" },
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

<HeaderManager />

<DataLoader />
<div class="globwrap">
  <div class="container">
    <h3>
      <a href="/lists" style="color:#333;">All lists</a>
    </h3>
    <UserLogin />
    <br />
    <div class="search-sort">
      <div class="search">
        {#if searchValue}
          <button on:click={() => (searchValue = "")}> Clear search </button>
        {/if}
        <Search bind:value={searchValue} hideLabel />
      </div>
      <div class="sort">
        <Select
          isClearable={false}
          placeholder="Sort by"
          items={sortingColumns}
          bind:value={currentSort}
        />
        <button
          on:click={() => {
            switchSort = switchSort == 1 ? -1 : 1;
            sort({ value: sortBy.col });
          }}
          class="switchSortDaddy"
        >
          <img
            src={"/images/" +
              (switchSort * -(sortBy.ascending ? 1 : -1) == 1
                ? "arrow-down-outline.svg"
                : "arrow-up-outline.svg")}
            alt=""
            class="switchSort"
          />
        </button>
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
          {#each searchIdeas as idea}
            <Idea {idea} {selectCategory} />
          {:else}
            <p class="not-found">No ideas found</p>
          {/each}
        {:else}
          {#each $shownIdeas as idea}
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
  <IdeaViewer {url} />
</div>

<style>
  .globwrap {
    padding-top: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: left;
    align-items: center;
    min-height: 100vh;
    background-color: transparent;
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

  .ideas-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    left: 0;
  }

  :global(.selectContainer) {
    flex-grow: 1;
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

  :global(body) {
    background-color: #fff;
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

  .switchSortDaddy {
    padding: 0.2rem 0.1rem;
    height: 2.6rem;
    background-color: var(--light-accent-bg);
    border: 1px solid #ddd;
    border-radius: var(--border-radius);
    margin: 0;
    margin-left: 0.3rem;
    transition: 0.2s ease-in-out all;
  }

  .switchSortDaddy:hover {
    border: 1px solid var(--primary-color);
    background-color: var(--primary-color-hover);
  }

  .switchSort {
    height: 1.5rem;
    filter: invert(0.5);
  }

  .sort {
    width: 30%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-left: 1%;
  }

  :global(::-webkit-scrollbar) {
    width: 0.35em;
    height: 0.35em;
    border-radius: var(--border-radius);
  }

  /* Track */
  :global(::-webkit-scrollbar-track) {
    border-radius: var(--border-radius);
    background: transparent;
  }

  /* Handle */
  :global(::-webkit-scrollbar-thumb) {
    border-radius: 1rem;
    background: #dedede;
  }

  /* Handle on hover */
  :global(::-webkit-scrollbar-thumb:hover) {
    background: #cdcdcd;
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
    background: transparent;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    border-radius: 1rem;
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
      padding: 0 0.5rem 0.5rem 0.5rem;
      text-align: center;
    }
  }
</style>
