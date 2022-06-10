<script>
  import { supabase } from "$lib/db";
  import { page } from "$app/stores";
  console.log(page);
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Footer from "$lib/Footer.svelte";
  import { ideas, superprojects, comments, loading } from "$lib/stores";
  import DataLoader from "$lib/DataLoader.svelte";

  const superprojectSlug = $page.params.superproject;

  let currentIdea = {},
    canClick = true,
    shownIdeas = [],
    selectedCategories = [],
    currentSuperproject = {},
    visible = false,
    loaded = false;

  $: {
    if (!$loading) {
      currentSuperproject = $superprojects.find(
        (s) => s.slug === superprojectSlug
      );

      shownIdeas = $ideas.filter((idea) =>
        idea.superprojects.find((s) => s.superproject.slug === superprojectSlug)
      );
    }
  }

  const selectIdea = (idea) => {
    if (!canClick) return;
    currentIdea = idea;
    setVisible(true);
  };

  const setVisible = (bowl) => {
    if (!canClick) return;
    visible = bowl;
  };
</script>

<DataLoader />

<Nav />

{#if $loading}
  <LoadIcon />
{:else if $superprojects.length > 0}
  <div class="wrapper">
    <div class="header-wrapper">
      <div class="go-to-home">
        {@html $superprojects.find((s) => s.slug === superprojectSlug)
          .authors || ""}
        <a href="/">Go to home page</a>
      </div>
      <h1>{$superprojects.find((s) => s.slug === superprojectSlug).title}</h1>
      {@html markdown(
        $superprojects.find((s) => s.slug === superprojectSlug).description
      )}
    </div>

    {#each $ideas.filter( (i) => i.superprojects.find((s) => s.superproject.slug === superprojectSlug) ) as idea}
      <Idea {idea} />
    {/each}
  </div>

  <IdeaViewer />
{/if}

<Footer />

<style>
  :global(body) {
    background-color: #f7f7f7;
  }
  .wrapper {
    margin: -2.5rem auto 1rem auto;
    padding: 12px 15px;
    background: var(--bg-color-light);
    position: relative;
    z-index: 30;
    border-radius: var(--border-radius);
    max-width: 830px;
  }

  div > h1 {
    margin-top: 0;
    text-align: center;
  }

  .header-wrapper {
    display: flex;
    margin: 0 auto;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
  }

  .go-to-home {
    display: flex;
    justify-content: flex-start;
    column-gap: 0.4rem;
    font-size: 0.8em;
    line-height: 0.8em;
    margin-bottom: 0.2rem;
    font-style: italic;
    text-decoration: none;
    color: var(--text-color-light);
  }

  @media (max-width: 768px) {
    .go-to-home {
      font-size: 1em;
      line-height: 1em;
      flex-direction: column-reverse;
      row-gap: 0.2rem;
      margin-bottom: 0.4rem;
    }

    .header-wrapper {
      align-items: flex-start;
    }

    div > h1 {
      text-align: left;
      font-size: 1.8rem;
      line-height: 2rem;
    }

    .wrapper {
      margin-top: 0;
    }
  }
</style>
