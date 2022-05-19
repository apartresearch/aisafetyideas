<script>
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import SuperprojectTag from "$lib/SuperprojectTag.svelte";
  export let idea, visible;
</script>

<div class="current-idea-col {visible ? '' : 'hidden'}">
  {#if idea.title}
    <p class="current-idea-author">{idea.author}</p>
    <h2 class="current-idea-title">{idea.title}</h2>
    <div class="current-idea-text">
      {@html markdown(idea.summary)}
    </div>
    {#if idea.categories[0]}
      <h4>Categories</h4>
      <div class="idea-categories-wrapper">
        {#each idea.categories as cat}
          <CategoryTag cat={cat.category} />
        {/each}
      </div>
    {/if}
    {#if idea.superprojects[0]}
      <h4>
        Superproject{idea.superprojects.length > 1 ? "s" : ""}
      </h4>
      <div class="idea-superprojects-wrapper">
        {#each idea.superprojects as superproject}
          <SuperprojectTag superproject={superproject.superproject} />
        {/each}
      </div>
    {/if}
  {:else}
    <h3>Select an idea</h3>
  {/if}
</div>

<style>
  .current-idea-col {
    display: flex;
    flex-direction: column;
    justify-content: top;
    align-items: top;
    margin-bottom: 20px;
    max-width: 700px;
    padding: 15px;
    background-color: #fff;
    min-height: 400px;
  }

  .current-idea-author {
    margin-bottom: 4px;
    line-height: 1em;
  }

  .current-idea-title {
    margin-top: 0;
    margin-bottom: 0.14em;
  }

  .idea-superprojects-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
    margin-bottom: 10px;
  }

  .hidden {
    display: none;
  }

  .idea-categories-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
  }
</style>
