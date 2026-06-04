<script>
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  export let node,
    small = false;
</script>

{#if small}
  <a
    class="idea-node list-item"
    use:tippy={{
      content: `${node.title}: ${node.summary} Click to see more.`,
    }}
    href={`/list/${node.slug}`}
  >
    <img src="/images/arrow-up.svg" alt="arrow" />
    {node.title}
  </a>
{:else}
  <a
    class="idea-node"
    href={`/list/${node.slug}`}
    use:tippy={{
      content: `${node.title}: ${node.summary} Click to see more.`,
    }}
  >
    {node.title}
  </a>
{/if}

<style>
  .idea-node {
    /* Styling for a tag */
    background-color: var(--node-color);
    border: 1px solid var(--light-accent-border);
    border-radius: var(--border-radius);

    vertical-align: bottom;

    padding: 0.2em 0.5em;
    margin-right: 0.4em;
    margin-bottom: 0.5em;
    font-size: 0.8em;
    line-height: 1em;
    text-decoration: none;
    color: white;
  }

  .idea-node:hover {
    opacity: 0.75;
    text-decoration: none;
    cursor: pointer;
  }

  .idea-node.list-item {
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

  .idea-node > img {
    width: 0.7em;
    height: 0.7em;
    margin: 0;
    padding: 0;
    margin-bottom: 0.4em;
  }
</style>
