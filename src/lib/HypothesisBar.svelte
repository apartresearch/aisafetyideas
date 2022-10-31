<script>
  import MediaQuery from "./MediaQuery.svelte";
  export let result = {},
    hypothesis = false;
  let hasResult = JSON.stringify(result) !== JSON.stringify({});
</script>

<!-- Show a colored bar with an icon based on if the idea is a hypothesis or not -->
<div
  class="bar {result && result.type ? result.type : 'open'}"
  on:click|stopPropagation
>
  <div class="left">
    {#if result && result.type}
      <img
        src="images/aisi_logo_white.png"
        alt="Hypothesis icon"
        class="icon"
      />
    {/if}
    <h3 class="title">
      <MediaQuery query="(max-width: 768px)" let:matches>
        {#if matches}
          {result && result.title
            ? result.title.slice(0, 36) +
              (result.title.length > 36 ? "..." : "")
            : "Open hypothesis"}
        {:else}
          {result && result.title
            ? result.title
            : `Open ${hypothesis ? "hypothesis" : "project idea"}`}
        {/if}
      </MediaQuery>
    </h3>
  </div>
  <div class="right">
    {#if result && result.type}
      <div class="type">
        <p>
          {result.type[0].toUpperCase() + result.type.substring(1)} result
        </p>
      </div>
      <a class="more" href={result.link} target="_blank"> Read more </a>
    {:else}
      <a class="more" href="/result" target="_blank">
        Submit a {hypothesis ? "result" : "project"}
      </a>
    {/if}
  </div>
</div>

<style>
  .positive {
    background-color: var(--positive);
  }

  .negative {
    background-color: var(--negative);
  }

  .open {
    background-color: var(--open);
  }

  .bar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin: 0.2rem -0.7rem -0.55rem -0.7rem;
    padding: 0.1rem 0.65rem 0.1rem 0.4rem;
    color: white;
    border: inherit;
    font-size: 0.9rem;
  }

  p {
    margin: 0 0.5rem;
  }

  a {
    color: white;
    text-decoration: none;
  }

  a:hover {
    text-decoration: none;
    opacity: 0.8;
  }

  .left {
    display: flex;
    flex-direction: row;
    align-items: center;
    column-gap: 0.2rem;
  }

  .right {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .title {
    margin: 0;
    font-size: 0.9rem;
  }

  .icon {
    width: 1em;
    margin-top: -0.15rem;
  }

  /* Mobile */
  @media only screen and (max-width: 600px) {
    .bar {
      margin: -0.55rem -0.7rem 0.2rem -0.7rem;
      flex-wrap: wrap;
      padding: 0.2rem 0.5rem 0.2rem 0.5rem;
      justify-content: right;
    }
    .left {
      flex-grow: 1;
    }
  }
</style>
