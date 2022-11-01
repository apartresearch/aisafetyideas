<script>
  import tippy from "tippy.js";
  import Moveable from "svelte-moveable";
  import markdown from "./drawdown";
  import { ideaViewVisible, ideaCurrent } from "./stores.js";

  export let i;
  let target,
    url,
    hover = false;

  const selectIdea = () => {
    $ideaViewVisible = true;
    $ideaCurrent = i;
    if (!url) {
      url = new URL(window.location.href);
    }
    url.searchParams.set("idea", i.id);
    window.history.pushState(null, document, url.href);
  };
</script>

<div
  class="node"
  bind:this={target}
  on:click={() => {
    selectIdea();
  }}
  on:mouseenter={() => {
    hover = true;
  }}
  on:mouseleave={() => {
    hover = false;
  }}
  style="position: absolute; left: {i.x1 * 100}%; top: {i.y1 * 100}%;"
>
  <p class="very-small">
    {i.title.length > 40 && !hover ? i.title.substr(0, 37) + "..." : i.title}
  </p>
</div>

<style>
  .very-small {
    font-size: 0.7rem;
    line-height: 0.8rem;
    margin: -0.2rem 0 0 1rem;
    padding: 0.2rem;
    width: 10rem;
    color: #0004;
    pointer-events: none;
  }

  .node {
    position: absolute;
    width: 1rem;
    height: 1rem;
    background-color: #eee;
    border: 1px solid var(--link-color);
    border-radius: 50%;
    cursor: pointer;
    z-index: 1;
  }

  .node:hover > .very-small {
    color: var(--link-color);
    background-color: #fff;
  }

  .node:hover {
    z-index: 2;
    background-color: var(--link-color);
  }
</style>
