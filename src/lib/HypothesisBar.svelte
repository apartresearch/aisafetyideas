<script>
  export let result = {};
  let hasResult = JSON.stringify(result) !== JSON.stringify({});
</script>

<!-- Show a colored bar with an icon based on if the idea is a hypothesis or not -->
<div class="bar {result.type ? result.type : 'open'}" on:click|stopPropagation>
  <div class="left">
    {#if result.type}
      <img
        src="images/aisi_logo_white.png"
        alt="Hypothesis icon"
        class="icon"
      />
    {/if}
    <h3 class="title">
      {result.title ? result.title : "Open hypothesis"}
    </h3>
  </div>
  <div class="right">
    {#if result.type}
      <div class="type">
        <p>
          {result.type[0].toUpperCase() + result.type.substring(1)} result
        </p>
      </div>
      <a class="more" href={result.link} target="_blank"> Read more </a>
    {:else}
      <a
        class="more"
        href="mailto:operations@apartresearch.com"
        target="_blank"
      >
        Submit a result
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
    padding: 0.2rem 0.65rem;
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
  }

  .right {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .title {
    margin: 0;
    margin-right: 1rem;
    margin-left: 0.3rem;
    font-size: 0.9rem;
  }

  .icon {
    width: 1em;
  }

  /* Mobile */
  @media only screen and (max-width: 600px) {
    .bar {
      margin: -0.55rem -0.7rem 0.2rem -0.7rem;
      flex-wrap: wrap;
      padding: 0.5rem;
      justify-content: right;
    }
    .left {
      width: 100%;
    }
  }
</style>
