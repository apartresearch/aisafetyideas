<script>
  let active = false;
</script>

<div class="corner" on:click={() => (active = !active)}>
  <img src="/images/construct-outline.svg" alt="Feedback icon" class="icon" />
  <p>Report an issue</p>
</div>
{#if active}
  <div class="form">
    <iframe
      src="https://docs.google.com/forms/d/e/1FAIpQLSdsciuO2VpFBJBWMRYN0Kmross1mTWttsEhyHvXw2bsw-S1RA/viewform?embedded=true"
      width="640"
      height="372"
      frameborder="0"
      marginheight="0"
      marginwidth="0"
      title="Feedback">Loading…</iframe
    >
  </div>
{:else}{/if}

<style>
  .corner {
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 1000;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    column-gap: 0.5em;
  }

  .corner > p {
    margin: 0;
    font-size: 0.8rem;
  }

  .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .form {
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 900;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 0.5rem;
  }
</style>
