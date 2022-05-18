<script>
  import tippy from "sveltejs-tippy";
  export let idea, selectIdea;
</script>

<div class="idea-card" on:mousedown={() => selectIdea(idea)}>
  <div class="idea-top">
    <div class="idea-superprojects-wrapper list-item">
      <div class="idea-author">
        {idea.author}
      </div>
      {#if idea.superprojects[0]}
        {#each idea.superprojects as superproject}
          <div
            class="idea-superproject list-item"
            use:tippy={{
              content: `<div class='tooltip'><h4>${
                superproject.superproject.title
              }</h4>${markdown(
                superproject.superproject.description
              )}<p><i>Click to see more ideas</i></p></div>`,
              allowHTML: true,
              interactive: true,
              delay: [500, 0],
            }}
          >
            <img src="images/arrow-up.svg" alt="arrow" />
            {superproject.superproject.title}
          </div>
        {/each}
      {/if}
    </div>
    <div class="idea-icons">
      {#if idea.contact}
        <a
          href="mailto:{idea.contact}"
          use:tippy={{
            content: `Email the author: <a href="mailto:${idea.contact}">${idea.contact}</a>`,
            allowHTML: true,
            interactive: true,
            delay: [250, 0],
            appendTo: document.body,
          }}
        >
          <img src="images/at.svg" alt="Send email to author icon" />
        </a>
      {/if}
      {#if idea.sourced}
        <a
          href={idea.sourced}
          target="_blank"
          use:tippy={{
            content: `View the source of this idea`,
            allowHTML: true,
            delay: [250, 0],
          }}
        >
          <img src="images/link.svg" alt="Source link icon" />
        </a>
      {/if}
      {#if idea.verified_by_expert}
        <div
          use:tippy={{
            content: `This idea has been verified by ${
              !idea.verifier ? "an expert" : idea.verifier
            }`,
            allowHTML: true,
            delay: [250, 0],
          }}
        >
          <img src="images/checkmark.svg" alt="Expert verified icon" />
        </div>
      {/if}
    </div>
  </div>
  <h3 class="idea-title">{idea.title}</h3>
  {#if idea.categories[0]}
    <div class="idea-categories-wrapper list-item">
      {#each idea.categories as cat, i}
        <div
          class="idea-category list-item"
          use:tippy={{
            content: `<div class='tooltip'><h5>${cat.category.title}</h5>${
              cat.category.tooltip !== null
                ? `<p>${markdown(cat.category.tooltip)}</p>`
                : ""
            }<p><i>Click to see more ideas in this category</i></p></div>`,
            allowHTML: true,
            delay: [1000, 0],
          }}
        >
          {cat.category.title}
        </div>
        {#if i < idea.categories.length - 1}
          <div class="idea-category-separator">·</div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .idea-category.list-item {
    margin: 0;
    margin-right: 2px;
    padding: 2px;
    font-size: 0.7em;
    line-height: 1em;
    background-color: transparent;
    border: none;
  }

  .idea-category:hover,
  .idea-superproject:hover {
    opacity: 0.75;
  }

  .idea-superprojects-wrapper.list-item {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
  }
  .idea-superproject.list-item {
    border: 0;
    padding: 0;
    margin: 0;
    font-size: 0.7em;
    line-height: 0.8em;
    border-radius: 0;
    margin-right: 4px;
    background-color: transparent;
    white-space: nowrap;
  }

  .idea-superproject > img {
    width: 0.7em;
    height: 0.7em;
    margin: 0;
    padding: 0;
    margin-bottom: 0.4em;
  }

  .idea-categories-wrapper.list-item {
    opacity: 0.75;
    font-style: italic;
    margin-left: -0.1em;
  }

  .idea-category-separator {
    margin: 0 0.1em 0.1em 0;
    line-height: 0.8em;
  }

  .idea-card {
    background-color: #fff;
    padding: 7px 10px;
    margin: 0;
    border-right: 2px solid #f9f9f9;
    border-bottom: 2px solid #f9f9f9;
    width: 100%;
  }

  .idea-card:hover {
    background-color: #fafafa;
    cursor: pointer;
  }

  .idea-top {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: -0.2em;
  }

  .idea-icons {
    display: flex;
    align-items: right;
    font-size: 0.7em;
    line-height: 0.8em;
  }

  .idea-icons * {
    margin: 0;
    margin-left: 0.1em;
    cursor: pointer;
    text-decoration: none;
  }

  .idea-icons > * > * {
    margin: 0;
    height: 1.4em;
  }

  .idea-icons *:hover {
    opacity: 0.75;
  }

  .idea-author {
    font-size: 0.7em;
    line-height: 0.8em;
    border: 0;
    padding: 0;
    vertical-align: bottom;
    margin-right: 0.6em;
    margin-top: 0.1em;
    white-space: nowrap;
  }

  .idea-title {
    font-size: 0.8em;
    line-height: 1em;
    margin: 5px 0 5px 0;
  }
</style>
