<script>
  import markdown from "$lib/drawdown.js";
  import tippy from "sveltejs-tippy";
  import { user } from "$lib/stores.js";
  export let node;
  //   Ensure that this does not become weirdo spaghetto as result of markdown content, i.e. stop at ][ or whatever regex shit works
</script>

<a class="wrapper" href={"/list/" + node.slug}>
  <div class="global-wrapper">
    <h3 class="header">
      {node.title} |
      <span class="idea_n">{node.ideas.length} ideas</span>
    </h3>
    {#if !node.summary}
      {@html markdown(node.description.slice(0, 50) + "...")}
    {:else}
      {@html markdown(node.summary)}
    {/if}
  </div>
</a>

<style>
  .header {
    font-size: 0.8rem;
    line-height: 0.9rem;
    margin: 0;
    margin-bottom: 0.15rem;
    font-weight: 600;
  }

  :global(.global-wrapper > p) {
    font-size: 0.8rem;
    line-height: 1rem;
    margin: 0;
  }

  .wrapper div:first-child {
    margin-bottom: 0.4rem;
  }

  .idea_n {
    color: white;
    font-size: 0.8rem;
    line-height: 1rem;
    margin: 0;
  }

  .wrapper {
    width: 32.5%;
    padding: 0.35rem;
    border-radius: var(--border-radius);
    color: white;
    background-color: var(--node-color);
    text-decoration: none;
    transition: all 0.1s ease-in-out;
  }

  .wrapper:hover {
    transform: translate(0, -2px);
    cursor: pointer;
  }

  .wrapper:hover .idea_n {
    color: var(--light-accent-text);
  }

  @media (max-width: 768px) {
    .wrapper {
      width: 100%;
      padding: 0.5rem;
    }

    :global(p),
    :global(h3) {
      font-size: 0.9rem;
      line-height: 1.1rem;
    }
  }
</style>
