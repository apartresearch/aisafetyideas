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
    content: `${cat.title}${cat.tooltip !== null ? ` - ${cat.tooltip}` : ""}`,
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
    background-color: var(--category-color);
    border: 1px solid var(--light-accent-border);
    border-radius: var(--border-radius);
    padding: 0.2em 0.5em;
    margin-right: 0.4em;
    margin-bottom: 0.3em;
    font-size: 0.8em;
    line-height: 1em;
    color: white;
    /* opacity: 0.75; */
  }

  .idea-category.list-item,
  .idea-category.filter {
    color: black;
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
    border-radius: var(--border-radius);
    margin: 0 1px;
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
