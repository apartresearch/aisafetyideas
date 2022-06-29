<script>
  import Nav from "$lib/Nav.svelte";
  import { user, superprojects, ideas } from "$lib/stores.js";
  import SuperprojectBlock from "$lib/SuperprojectBlock.svelte";
  import MediaQuery from "$lib/MediaQuery.svelte";
  import BurgerButton from "$lib/BurgerButton.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Footer from "$lib/Footer.svelte";
</script>

<DataLoader />
<Nav />
<div class="wrapper">
  <h2>Projects</h2>
  <p>Click on a project to see the ideas in each.</p>
  <div class="project-contain">
    {#await $superprojects}
      <p>Loading projects...</p>
    {:then superprojects}
      {#await $ideas then ideas}
        {#each superprojects as project}
          <SuperprojectBlock {project} {ideas} />
        {/each}
      {/await}
    {:catch}
      <p>Error loading projects.</p>
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
