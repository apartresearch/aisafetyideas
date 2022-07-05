<script>
  import {uploadIdea} from "$lib/db.js";
  let title = "";
  let description = "";
</script>

<div class={"wrap " + (title != "" ? "expanded" : "")}>
  <h3 class="head">Submit idea here</h3>
  <div class="input-wrapper">
    <label for="title">Title</label>
    <input type="text" bind:value={title} />
  </div>
  {#if title != ""}
    <div class="input-wrapper description">
      <label for="description">
        Description (supports
        <a target="_blank" href="https://adamvleggett.github.io/drawdown/">
          markdown
        </a>
        )
      </label>
      <textarea rows="8" bind:value={description} />
    </div>
  {/if}
</div>

<style>
  label {
    font-size: 0.7em;
    line-height: 1em;
    padding-right: 0.5em;
    font-style: none;
    width: 30%;
  }

  .input-wrapper input,
  .input-wrapper textarea,
  .input-wrapper .select {
    margin-bottom: 5px;
    width: 70%;
    font-size: 0.7em;
    line-height: 1em;
  }

  .description textarea {
    min-height: 100px;
  }

  .input-wrapper {
    display: flex;
    flex-direction: row;
    margin: 2px;
    width: 100%;
  }

  .wrap {
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
    height: 10rem;
    width: 60rem;
    max-width: 60rem;
    transition: 0.3s ease-in-out height;
    border: 1px solid var(--light-accent-border);
    background-color: var(--light-accent-bg);
    overflow: hidden;
  }

  .wrap.expanded {
    height: 20rem;
  }
</style>
