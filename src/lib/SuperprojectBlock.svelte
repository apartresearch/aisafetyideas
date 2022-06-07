<script>
  import markdown from "$lib/drawdown.js";
  export let project, ideas;
  //   Ensure that this does not become weirdo spaghetto as result of markdown content, i.e. stop at ][ or whatever regex shit works
  const p_text = project.summary.substring(0, 150);
  +"...";
</script>

<div class="wrapper">
  <h3 class="header">{project.title}</h3>
  <p class="text">
    {@html markdown(p_text)}
  </p>
  <div class="bottom">
    <p class="idea_n">
      {ideas.filter((idea) =>
        idea.superprojects.find((p) => p.superproject.id == project.id)
      ).length} ideas
    </p>
  </div>
</div>

<style>
  .header {
    font-size: 2em;
  }

  .text {
    font-size: 0.7em;
    line-height: 0.8em;
  }

  .wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 4em;
  }
</style>
