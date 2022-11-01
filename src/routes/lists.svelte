<script>
  import Nav from "$lib/Nav.svelte";
  import { user, nodes } from "$lib/stores.js";
  import ListBlock from "$lib/ListBlock.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Footer from "$lib/Footer.svelte";
</script>

<DataLoader />
<Nav />
<div class="wrapper">
  <h2>Lists</h2>
  <p>Click on a list to visit its page.</p>
  <div class="project-contain">
    {#await $nodes}
      <p>Loading lists...</p>
    {:then $nodes}
      {#each $nodes as node}
        <ListBlock {node} />
      {/each}
    {:catch}
      <p>Error loading lists.</p>
    {/await}
  </div>
</div>

<Footer />

<style>
  .wrapper {
    padding: 0 1rem;
    text-align: center;

    max-width: 1200px;
    margin: 0 auto 0 auto;

    z-index: 103;
    position: relative;
  }

  .project-contain {
    text-align: left;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: left;
    align-items: stretch;
    max-width: 1000px;
    column-gap: 0.5rem;
    row-gap: 0.5rem;
    margin-top: 0.25rem;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .wrapper {
      margin: 0;
      padding: 0.2rem;
      z-index: 0;
    }
  }
</style>
