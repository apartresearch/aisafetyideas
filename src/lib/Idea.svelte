<script>
  import markdown from "$lib/drawdown";
  import tippy from "sveltejs-tippy";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import SuperprojectTag from "$lib/SuperprojectTag.svelte";
  export let idea,
    selectIdea = undefined,
    selectCategory = undefined;
</script>

<div class="idea-card" on:click={() => selectIdea(idea)}>
  <div class="idea-top">
    <div class="idea-superprojects-wrapper list-item" on:click|stopPropagation>
      <div class="idea-author">
        {idea.author}
      </div>
      {#if idea.superprojects[0]}
        {#each idea.superprojects as superproject}
          <SuperprojectTag
            superproject={superproject.superproject}
            small={true}
          />
        {/each}
      {/if}
    </div>
    <div class="idea-icons" on:click|stopPropagation>
      {#if idea.contact}
        <a
          target="_blank"
          href="mailto:{idea.contact}"
          use:tippy={{
            content: `Email the author: <a target="_blank" href="mailto:${idea.contact}">${idea.contact}</a>`,
            allowHTML: true,
            interactive: true,
            delay: [250, 0],
            appendTo: document.body,
          }}
        >
          <img src="/images/at.svg" alt="Send email to author icon" />
        </a>
      {/if}
      {#if idea.sourced}
        <a
          href={idea.sourced}
          target="_blank"
          use:tippy={{
            content: `View the source of this idea`,
            allowHTML: true,
            delay: [250, 0],
          }}
        >
          <img src="/images/link.svg" alt="Source link icon" />
        </a>
      {/if}
      {#if idea.verified_by_expert}
        <div
          use:tippy={{
            content: `This idea has been verified by ${
              !idea.verifier ? "an expert" : idea.verifier
            }`,
            allowHTML: true,
            delay: [250, 0],
          }}
        >
          <img src="/images/checkmark.svg" alt="Expert verified icon" />
        </div>
      {/if}
    </div>
  </div>
  <h3 class="idea-title">{idea.title}</h3>
  {#if idea.categories[0]}
    <div class="idea-categories-wrapper list-item" on:click|stopPropagation>
      {#each idea.categories as cat, i}
        <CategoryTag cat={cat.category} small={true} {selectCategory} />
        {#if i < idea.categories.length - 1}
          <div class="idea-category-separator">·</div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .idea-superprojects-wrapper.list-item {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
  }

  .idea-categories-wrapper.list-item {
    font-style: italic;
    margin-left: -0.1em;
    float: left;
  }

  .idea-category-separator {
    margin: 0 0.1em 0.1em 0;
    line-height: 0.8em;
  }

  .idea-card {
    background-color: #fff;
    padding: 7px 10px;
    margin: 0;
    border-right: 2px solid #f9f9f9;
    border-bottom: 2px solid #f9f9f9;
    width: 100%;
    overflow: auto;
  }

  .idea-card:hover {
    background-color: #fafafa;
    cursor: pointer;
  }

  .idea-top {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: -0.2em;
  }

  .idea-icons {
    display: flex;
    align-items: right;
    font-size: 0.7em;
    line-height: 0.8em;
  }

  .idea-icons * {
    margin: 0;
    margin-left: 0.1em;
    cursor: pointer;
    text-decoration: none;
  }

  .idea-icons > * > * {
    margin: 0;
    height: 1.4em;
  }

  .idea-icons *:hover {
    opacity: 0.75;
  }

  .idea-author {
    font-size: 0.7em;
    line-height: 0.8em;
    border: 0;
    padding: 0;
    vertical-align: bottom;
    margin-right: 0.6em;
    margin-top: 0.1em;
    white-space: nowrap;
  }

  .idea-title {
    font-size: 0.8em;
    line-height: 1em;
    margin: 5px 0 5px 0;
  }
</style>
