<script>
  export let result = {};
</script>

<!-- Show a colored bar with an icon based on if the idea is a hypothesis or not -->
<div class="bar {result.type}">
  <div class="left">
    <div class="title">
      <h3>{result.title}</h3>
    </div>
    <img src="images/aisi_logo.png" alt="Hypothesis icon" class="icon" />
  </div>
  <div class="right">
    <div class="type">
      <p>{result.type}</p>
    </div>
    <a class="more" href="result/{result.id}"> Read more </a>
  </div>
</div>

<style>
  .positive {
    background-color: #00b300;
  }

  .negative {
    background-color: #ff0000;
  }

  .open {
    background-color: #ffcc00;
  }

  .bar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 1em;
    margin: 1em;
    border-radius: 0.5em;
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
    margin-right: 1em;
  }
</style>
