<script>
  import markdown from "$lib/drawdown.js";
  import tippy from "sveltejs-tippy";
  export let project;
  import { ideas, user } from "$lib/stores.js";
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
  <div class="global-wrapper">
    <h3 class="header">
      {project.title} |
      <span class="idea_n"
        >{$ideas.filter((idea) =>
          idea.superprojects.find((p) => p.superproject.id == project.id)
        ).length} ideas</span
      >
    </h3>
    {@html markdown(project.summary)}
  </div>
</a>

<style>
  .header {
    font-size: 0.8rem;
    line-height: 1rem;
    margin: 0;
    margin-bottom: 0.15rem;
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
    color: #999;
    font-size: 0.8rem;
    line-height: 1rem;
    margin: 0;
  }

  .wrapper {
    width: 49.5%;
    padding: 0.35rem;
    border-radius: var(--border-radius);
    border: 1px solid var(--primary-color);
    color: var(--light-accent-text);
    text-decoration: none;
    transition: all 0.1s ease-in-out;
  }

  .wrapper:hover {
    transform: translate(0, -2px);
    cursor: pointer;
  }

  .wrapper .idea_n {
    color: var(--link-color);
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
