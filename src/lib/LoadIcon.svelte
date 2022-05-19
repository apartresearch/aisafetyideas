<div class="loading-wrapper">
  <img src="/images/load_icon.png" alt="Loading icon" class="loading-icon" />
  <p>Loading...</p>
</div>

<style>
  .loading-icon {
    margin: 0 auto;
    margin-top: 20px;
    margin-bottom: 20px;
    width: 5em;
    height: 5em;
    /* Rotate continusously */
    -webkit-animation: spin 1.1s ease-in-out infinite;
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
