<script>
  import {uploadIdea} from "$lib/db.js";
  import {user, ideas} from "$lib/stores.js";
  import MediaQuery from "./MediaQuery.svelte";
  
  let title = "";
  let description = "";
</script>

<MediaQuery query="(max-width: 768px)" let:matches>
  <div class={"wrap " + (title != "" ? "expanded" : "")}>
      <div class="left">
        <h3 class="head">Submit idea (<a href="/submit">add more info</a>)</h3>
        <p class="label">Add any ideas you have and <a href="/submit">go here</a> if you want to add categories and related projects. We will look through the idea and make it more shovel-ready when we receive it.</p>
        {#if !matches}
        <button class="btn" on:click={() => {
          uploadIdea({
            // Take the largest value of idea.id and +1
            id: Math.max(...$ideas.map(idea => idea.id)) + Math.floor(Math.random() * 10),
            title,
            summary: description,
            user: $user.id,
            career_difficulty: "Signal"
          });
          title = "";
          description = "";
        }}
      disabled={!$user}
      >
        {$user ? "Submit" : "Login to submit"}
      </button>
        {/if}
      </div>
    <div class="right">
      <label for="title">Title</label>
      <input type="text" bind:value={title} />
      <label for="description">
        Description (supports
        <a target="_blank" href="https://adamvleggett.github.io/drawdown/">
          markdown
        </a>
        )
      </label>
      <textarea rows="4" bind:value={description} />
    </div>
      {#if matches}
      <button class="btn" on:click={() => {
        uploadIdea({
          title,
          summary: description,
          user: $user.id,
          career_difficulty: "Signal"
        });
        title = "";
        description = "";
      }}
      disabled={!$user}
      >
        {$user ? "Submit" : "Login to submit"}
      </button>
  {/if}
</div>
</MediaQuery>

<style>
  .right {
    width: 60%;
    display: flex;
    flex-direction: column;
  }

  .left {
    width: 40%;
    float: left;
    display: flex;
    flex-direction: column;
    align-items: left;
  }

  .head {
    margin: 0;
    text-align: left;
  }
  
  button {
    padding: 0.25rem 1.5rem;
    margin-right: 1rem;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: var(--border-radius);
  }

  button:hover {
    background-color: #fff;
  }

  button:disabled {
    opacity: 60%;
    background-color: #ccc;
    font-style: italic;
  }

  label, .label {
    font-size: 0.8rem;
    line-height: 1rem;
    font-weight: normal;
    padding-right: 0.5rem;
    font-style: none;
    text-align: left;
  }

  input,
  textarea {
    font-size: 0.7em;
    line-height: 1em;
    border: 1px solid #ccc;
    border-radius: 0.2em;
    padding: 0.5em;
    width: 100%;
    margin-bottom: 0.25rem;
  }

  .input-wrapper {
    display: flex;
    flex-direction: row;
    margin: 2px;
    width: 100%;
  }

  @media (max-width: 768px) {
    .right, .left {
      width: 100%;
    }

    .head {
      margin-top: 0.5rem;
      text-align: center;
    }
  }
</style>
