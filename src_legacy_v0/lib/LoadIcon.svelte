<script>
  export let small = false;
</script>

<div class="loading-wrapper">
  <div class="loading-icons">
    <img
      src="/images/aisi_logo_inner.png"
      alt="Loading icon"
      class="loading-icon {small ? 'small' : ''}"
    />
    <img
      src="/images/aisi_logo_outer.png"
      alt="outer logo dots"
      class="outer"
    />
  </div>
  <p>Loading...</p>
</div>

<style>
  .small {
    width: 24px;
    height: 24px;
  }

  .loading-icons {
    position: relative;
    width: 5em;
    height: 5em;
    margin-bottom: 1em;
  }

  .loading-icon {
    margin: 1em;
    margin-top: 1.2em;
    width: 3em;
    height: 3em;
    /* Rotate continusously */
    -webkit-animation: spin 1.1s ease-in-out infinite;
    animation-delay: 0.25s;
  }

  .outer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    width: 5em;
    height: 5em;
    z-index: -1;
    -webkit-animation: spin 10s linear infinite;
    animation-delay: 0.25s;
  }

  .loading-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
</style>
