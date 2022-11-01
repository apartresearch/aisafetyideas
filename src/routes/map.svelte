<script>
  import Nav from "$lib/Nav.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Footer from "$lib/Footer.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import IdeaNode from "$lib/IdeaNode.svelte";
  import InfiniteViewer from "svelte-infinite-viewer";

  import {
    loading,
    ideas,
    nodes,
    nodeIdeaRelations,
    ideaRelations,
  } from "$lib/stores.js";
</script>

<Nav />
<DataLoader />
{#if $loading}
  <div class="loading">Loading...</div>
{:else}
  <div class="map">
    <InfiniteViewer
      className="viewer"
      rangeX={[0, 1000]}
      rangeY={[0, 1000]}
      padding={100}
      zoom={1}
    >
      {#each $ideas.filter((i) => i.x1) as idea}
        <IdeaNode i={idea} />
      {/each}
      {#each $ideaRelations as r}
        <svg class="relation">
          ><line
            x1="calc({r.parent_idea.x1 * 100}% + 0.5rem)"
            y1="calc({r.parent_idea.y1 * 100}% + 0.5rem)"
            x2="calc({r.child_idea.x1 * 100}% + 0.5rem)"
            y2="calc({r.child_idea.y1 * 100}% + 0.5rem)"
          /></svg
        >
      {/each}
    </InfiniteViewer>
  </div>
{/if}

<IdeaViewer />
<Footer />

<style>
  .relation {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
    stroke: var(--primary-color);
  }

  :global(.viewer) {
    width: 100%;
    height: 100%;
  }

  .map {
    position: relative;
    width: 100%;
    height: 1200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: white;
    margin: 0 auto;
  }
</style>
