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

  let mult = 75;
</script>

<Nav />
<DataLoader />
<div class="container">
  <h1>Map view (experimental)</h1>
  <p>
    Each idea is mapped as a blue dot and each list as a green dot. The
    connections between each is marked by a line. Click on a dot to see the
    details of the idea or navigate to the list.
  </p>
  <p>
    The positions of the nodes are based on similarity embeddings. Scroll
    horizontally and vertically to see all nodes.
  </p>
</div>
{#if $loading}
  <div class="loading">Loading...</div>
{:else}
  <div class="map">
    <InfiniteViewer
      className="viewer"
      rangeX={[0, 1000]}
      rangeY={[0, 1000]}
      padding={20}
      zoom={1}
    >
      {#each $ideas.filter((i) => i.x1) as idea}
        <IdeaNode i={idea} />
      {/each}
      {#each $ideaRelations as r}
        <svg class="relation">
          ><line
            x1="calc({r.parent_idea.x1 * mult}% + 0.5rem)"
            y1="calc({r.parent_idea.y1 * mult}% + 0.5rem)"
            x2="calc({r.child_idea.x1 * mult}% + 0.5rem)"
            y2="calc({r.child_idea.y1 * mult}% + 0.5rem)"
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
    stroke: var(--link-color);
  }

  :global(.viewer) {
    width: 100%;
    height: 100%;
  }

  .map {
    position: relative;
    width: 100%;
    height: 1200px;
    margin: 0 auto;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
  }
</style>
