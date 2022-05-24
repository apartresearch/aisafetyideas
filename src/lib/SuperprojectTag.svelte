<script>
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  export let superproject,
    small = false;
</script>

{#if small}
  <a
    class="idea-superproject list-item"
    use:tippy={{
      content: `<div class='tooltip'><h4>${superproject.title}</h4>${markdown(
        superproject.description
      )}<p><i>Click to see more ideas</i></p></div>`,
      allowHTML: true,
      interactive: true,
      delay: [500, 0],
    }}
    href={`/project/${superproject.slug}`}
  >
    <img src="/images/arrow-up.svg" alt="arrow" />
    {superproject.title}
  </a>
{:else}
  <a
    class="idea-superproject"
    use:tippy={{
      content: `<div class='tooltip'><h4>${superproject.title}</h4>${markdown(
        superproject.description
      )}<p><i>Click to see more ideas</i></p></div>`,
      allowHTML: true,
      interactive: true,
      delay: [500, 0],
    }}
    href={`/superprojects/${superproject.slug}`}
  >
    {superproject.title}
  </a>
{/if}

<style>
  .idea-superproject {
    /* Styling for a tag */
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    vertical-align: bottom;

    padding: 0.2em 0.5em;
    margin-right: 0.4em;
    margin-bottom: 0.5em;
    font-size: 0.8em;
    line-height: 1em;
    text-decoration: none;
    color: inherit;
  }

  .idea-superproject:hover {
    opacity: 0.75;
    text-decoration: none;
    cursor: pointer;
  }

  .idea-superproject.list-item {
    border: 0;
    padding: 0;
    margin: 0;
    font-size: 0.7em;
    line-height: 0.8em;
    border-radius: 0;
    margin-right: 4px;
    background-color: transparent;
    white-space: nowrap;
    color: black;
  }

  .idea-superproject > img {
    width: 0.7em;
    height: 0.7em;
    margin: 0;
    padding: 0;
    margin-bottom: 0.4em;
  }
</style>
