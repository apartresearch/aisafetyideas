<script>
  import Nav from "$lib/Nav.svelte";
  import { user, superprojects, ideas } from "$lib/stores.js";
  import SuperprojectBlock from "$lib/SuperprojectBlock.svelte";
  import MediaQuery from "$lib/MediaQuery.svelte";
  import BurgerButton from "$lib/BurgerButton.svelte";
</script>

<Nav />
<MediaQuery query="(max-width: 768px)" let:matches>
  {#if matches}
    <h2>Projects</h2>
  {/if}
</MediaQuery>
<p>Click on a project to see the ideas in each.</p>
<div class="project-contain">
  {#await $superprojects}
    <p>Loading projects...</p>
  {:then superprojects}
    {#await $ideas then ideas}
      {console.log(superprojects, ideas)}
      {#each superprojects as project}
        <SuperprojectBlock {project} {ideas} />
      {/each}
    {/await}
  {:catch}
    <p>Error loading projects.</p>
  {/await}
</div>

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
</style>
