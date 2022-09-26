<script>
  import { supabase } from "$lib/db";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Footer from "$lib/Footer.svelte";
  import { ideas, superprojects, comments, loading } from "$lib/stores";
  import UserLogin from "$lib/UserLogin.svelte";
  import DataLoader from "$lib/DataLoader.svelte";

  const superprojectSlug = "black-box-investigation";

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

<!-- <Nav showText={false} /> -->

<div class="header">
  <UserLogin white={true} />
  <h1>Research Hackathon Inspiration</h1>
</div>

{#if $loading}
  <LoadIcon />
  <div class="filler" />
{:else if $superprojects.length > 0}
  <div class="wrapper">
    <div class="header-wrapper">
      {@html markdown(
        $superprojects.find((s) => s.slug === superprojectSlug).description
      )}
    </div>
    <a href="/submit">Submit another idea</a>

    {#each $ideas.filter( (i) => i.superprojects.find((s) => s.superproject.slug === superprojectSlug) ) as idea}
      <Idea {idea} />
    {/each}
  </div>

  <IdeaViewer />
{/if}

<Footer />

<style>
  .header {
    padding: 0 15px;
    max-width: 830px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: flex-start;
    padding-top: 1rem;
    row-gap: 1rem;
  }

  .header > h1 {
    font-size: 2.5rem;
    line-height: 3rem;
    font-weight: 600;
    margin: 0;
  }

  .filler {
    height: 100vh;
  }

  .wrapper {
    margin: 0 auto 1rem auto;
    padding: 12px 15px;
    position: relative;
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
