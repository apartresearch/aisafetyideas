<script>
  import markdown from "$lib/drawdown";
  import tippy from "sveltejs-tippy";
  export let cat,
    small = false,
    filter = false,
    selected = false,
    selectCategory;
</script>

<div
  class="idea-category {filter ? 'filter' : ''} {small
    ? 'list-item'
    : ''} {selected ? 'selected' : ''}"
  use:tippy={{
    content: `<div class='tooltip'><h5>${cat.title}</h5>${
      cat.tooltip !== null ? `<p>${markdown(cat.tooltip)}</p>` : ""
    }<p><i>Click to filter ideas for this category</i></p></div>`,
    allowHTML: true,
    delay: [1000, 0],
  }}
  on:click={() => {
    selectCategory
      ? selectCategory(cat.title)
      : console.log("selectCategory is not defined.");
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
  }

  .idea-category.filter.selected {
    /* Make background green */
    background-color: #44ff98;
  }

  .idea-category.filter {
    background-color: #fff;
    flex-grow: 1;
    text-align: center;
  }

  .idea-category:hover {
    opacity: 0.75;
    cursor: pointer;
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
    opacity: 0.75;
    text-decoration: none;
  }
</style>
