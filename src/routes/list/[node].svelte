<script>
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Footer from "$lib/Footer.svelte";
  import { nodes, loading, ideas } from "$lib/stores";
  import DataLoader from "$lib/DataLoader.svelte";
  import SubmitBlock from "$lib/SubmitBlock.svelte";

  const nodeSlug = $page.params.node;

  let currentnode = null;

  // Wait for $loading to be false and then set currentnode
  onMount(async () => {
    while ($loading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    currentnode = $nodes.find((node) => node.slug === nodeSlug);
  });
</script>

<DataLoader />

<Nav />

{#if $loading}
  <LoadIcon />
  <div class="filler" />
{:else if currentnode}
  <div class="wrapper">
    <div class="header-wrapper">
      <div class="go-to-home">
        {@html markdown(currentnode.author || "")}
        <a href="/">Go to home page</a>
      </div>
      <h1>{currentnode.title}</h1>
      {@html markdown(currentnode.description)}
    </div>

    {#each currentnode.ideas as i}
      <Idea idea={i.idea} />
    {/each}

    <SubmitBlock
      list={currentnode.id}
      text={"Add more ideas to this list. When you submit on this page, the idea will automatically be added to the list. <a href='/submit'>Go here</a> if you want to add categories and related projects."}
    />
  </div>

  <IdeaViewer />
{/if}

<Footer />

<style>
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
