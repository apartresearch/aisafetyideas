<script>
  import markdown from "$lib/drawdown.js";
  import tippy from "sveltejs-tippy";
  export let project, ideas;
  //   Ensure that this does not become weirdo spaghetto as result of markdown content, i.e. stop at ][ or whatever regex shit works
</script>

<a
  class="wrapper"
  href={"/project/" + project.slug}
  use:tippy={{
    content: `See all ideas in the project <i>${project.title}</i>`,
    allowHTML: true,
    delay: [250, 0],
    appendTo: document.body,
  }}
>
  <div>
    <h3 class="header">{project.title}</h3>
    {@html markdown(project.summary)}
  </div>
  <div class="bottom">
    <p class="idea_n">
      {ideas.filter((idea) =>
        idea.superprojects.find((p) => p.superproject.id == project.id)
      ).length} ideas
    </p>
  </div>
</a>

<style>
  .header {
    font-size: 0.8rem;
    line-height: 1rem;
    margin: 0;
    margin-bottom: 0.15rem;
  }

  :global(p) {
    font-size: 0.8rem;
    line-height: 1rem;
    margin: 0;
  }

  .wrapper div:first-child {
    margin-bottom: 0.4rem;
  }

  .bottom {
    margin: 0;
    padding: 0;
  }

  .idea_n {
    color: #999;
    margin: 0;
  }

  .wrapper {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 4rem;
    width: 12rem;
    padding: 0.75rem;
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
    background-color: var(--light-accent-bg);
    border: 1px solid var(--light-accent-border);
    color: var(--light-accent-text);
    text-decoration: none;
    transition: all 0.1s ease-in-out;
  }

  .wrapper:hover {
    transform: translate(0, -0.1rem);
    box-shadow: var(--box-shadow-hover);
    border: 1px solid var(--primary-color);
    background-color: var(--primary-color-hover);
    cursor: pointer;
  }

  .wrapper:hover .idea_n {
    color: var(--primary-color);
  }

  @media (max-width: 768px) {
    .wrapper {
      width: 100%;
      padding: 0.5rem;
      text-align: left;
    }

    :global(p),
    :global(h3) {
      font-size: 0.9rem;
      line-height: 1.1rem;
    }
  }
</style>
