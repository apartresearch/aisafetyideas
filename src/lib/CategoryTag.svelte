<script>
  import markdown from "$lib/drawdown";
  import tippy from "sveltejs-tippy";
  export let cat,
    small = false,
    filter = false,
    selected = false,
    selectCategory = undefined;
</script>

<div
  class="idea-category {filter ? 'filter' : ''} {small
    ? 'list-item'
    : ''} {selected ? 'selected' : ''}"
  use:tippy={{
    content: `<div class='tooltip'><h5>${cat.title}</h5>${
      cat.tooltip !== null ? `<p>${markdown(cat.tooltip)}</p>` : ""
    }<p><i>${
      selectCategory
        ? "Click to filter for this category"
        : `<a href=${`https://aisafetyideas.com/?categories=${encodeURIComponent(
            cat.title
          )}`} on:click={location.reload()}>Click to link all ideas with this category</a>`
    }</i></p></div>`,
    allowHTML: true,
    interactive: selectCategory ? false : true,
    delay: [1000, 0],
  }}
  on:click={() => {
    selectCategory
      ? selectCategory(cat.title)
      : console.log("selectCategory is not within scope.");
  }}
>
  {cat.title}
</div>

<style>
  .idea-category {
    /* Styling for a tag */
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    padding: 0.2em 0.5em;
    margin-right: 0.4em;
    margin-bottom: 0.3em;
    font-size: 0.8em;
    line-height: 1em;
    /* opacity: 0.75; */
  }

  .idea-category.list-item {
    opacity: 0.75;
  }

  .idea-category.list-item:hover {
    opacity: 0.5;
  }

  .idea-category.filter.selected {
    /* Make background green */
    background-color: var(--primary-color);
    color: var(--font-color-dark);
  }

  .idea-category.filter {
    background-color: var(--light-accent-bg);
    flex-grow: 0;
    text-align: center;
    white-space: nowrap;
    opacity: 1;
  }

  .idea-category.list-item {
    margin: 0;
    margin-right: 2px;
    padding: 2px;
    font-size: 0.7em;
    line-height: 1em;
    background-color: transparent;
    border: none;
  }

  .idea-category:hover {
    cursor: pointer;
    opacity: 0.75;
    text-decoration: none;
  }

  :global(.tooltip a) {
    text-decoration: none;
    color: var(--link-color);
  }
  :global(.tooltip a:hover) {
    text-decoration: underline;
  }

  /* mobile style */
  @media (max-width: 768px) {
    .idea-category.filter {
      flex-grow: 0;
      white-space: nowrap;
      height: 2.4em;
      line-height: 2em;
      padding: auto 1em;
    }
  }
</style>
