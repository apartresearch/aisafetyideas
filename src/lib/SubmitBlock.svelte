<script>
  import {uploadIdea} from "$lib/db.js";
import MediaQuery from "./MediaQuery.svelte";
  
  let title = "";
  let description = "";
</script>

<div class={"wrap " + (title != "" ? "expanded" : "")}>
  <h3 class="head">Submit idea (<a href="/submit">add more info</a>)</h3>
  <div class="input-wrapper">
    <label for="title">Title</label>
    <input type="text" bind:value={title} />
  </div>
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
  <div class="bottom">
    <button class="btn" on:click={() => {
      uploadIdea({
        title,
        summary: description,
      });
      title = "";
      description = "";
    }}>
      Submit
    </button>
    </div>
</div>

<style>
  .head {
    margin: 0;
  }

  
  button {
    margin: 1rem;
    padding: 1.5rem 3rem;
    border: 1px solid #ccc;
    border-radius: 0.5em;
  }

  label {
    font-size: 0.8rem;
    line-height: 1rem;
    font-weight: normal;
    padding-right: 0.5rem;
    font-style: none;
    width: 15%;
    text-align: right;
  }

  .input-wrapper input,
  .input-wrapper textarea,
  .input-wrapper .select {
    margin-bottom: 5px;
    width: 85%;
    font-size: 0.7em;
    line-height: 1em;
  }

  input,
  textarea {
    border: 1px solid #ccc;
    border-radius: 0.2em;
    margin: 0;
    padding: 0.5em;
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

  @media (max-width: 768px) {
    .input-wrapper input, .input-wrapper textarea, .input-wrapper .select, label {
      width: 100%;
    }

    .input-wrapper {
      flex-direction: column;
    }
  }
</style>
