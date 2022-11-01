<script>
  import { supabase, getTable } from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import Nav from "$lib/Nav.svelte";
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import Footer from "$lib/Footer.svelte";
  import { user, ideas, nodes } from "$lib/stores";
  import UserLogin from "$lib/UserLogin.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Idea from "$lib/Idea.svelte";

  let loadedIdeas = [],
    ideaSelect = [],
    results = [],
    loadedNodes = [],
    selectedIdeas = [];

  let author = "",
    title = "",
    description = "",
    source = "",
    image_link = "",
    slug = "",
    id = null,
    track = false;

  onMount(async () => getTables());

  const getTables = async () => {
    [loadedIdeas, loadedNodes] = await Promise.all([
      getTable("ideas"),
      getTable("nodes"),
    ]);

    loadedIdeas = loadedIdeas.map((idea) => {
      return {
        label: idea.title,
        value: idea.id,
      };
    });

    id = loadedNodes[loadedNodes.length - 1].id + 1;
  };

  const addNewList = async (result) => {
    // Validate slug to be unique and warn if not
    if (
      $nodes.some(
        (node) => node.slug === title.toLowerCase().replace(/ /g, "-")
      )
    ) {
      alert("Slug already exists");
      return;
    }

    if (title == "") {
      alert("Title is required");
      return;
    }

    try {
      alert(`Your list is now live!`);

      const { data, error } = await supabase.from("nodes").upsert(result);
      // Add all selected ideas to the nodes_ideas table
      selectedIdeas.forEach(async (idea) => {
        const { data, error } = await supabase
          .from("nodes_ideas")
          .upsert({ list: id, idea: idea.value, user: $user.id });
      });
      if (error) {
        console.log(error);
        return;
      }
      resetData();
    } catch (err) {
      console.error(err);
    }
    resetData();
  };

  const resetData = (reload = true) => {
    if (reload) getTables();
    title = "";
    description = "";
    source = "";
    author = "";
  };

  $: {
    slug = title.toLowerCase().replace(/ /g, "-");
  }
</script>

<svelte:head>
  <title>Create new list | AI safety ideas</title>
</svelte:head>

<Nav />
<DataLoader />

<div class="cols-wrapper">
  <!-- <div class="col-parent"> -->

  <div class="add-idea-wrapper">
    <h2>Create a new list</h2>
    {#if !$user}
      <div class="login-warning">
        <p>Please login to create a new list.</p>
        <UserLogin />
      </div>
    {:else}
      <div class="input-wrapper">
        <label for="title">Title</label>
        <input type="text" bind:value={title} maxlength="80" />
      </div>
      <div class="input-wrapper">
        <label for="slug">URL</label>
        <input type="text" disabled bind:value={slug} maxlength="80" />
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
      {#if description != ""}
        <div class="description-preview">
          <p>Description preview</p>
          {@html markdown(description)}
        </div>
      {/if}

      <div class="input-wrapper">
        <label for="sourced"> Link </label>
        <input type="text" bind:value={source} />
      </div>
      <div class="input-wrapper">
        <label for="sourced"> Link to main image (optional) </label>
        <input type="text" bind:value={image_link} />
      </div>
      <div class="input-wrapper">
        <label for="author">Author (if not you)</label>
        <input type="text" bind:value={author} />
      </div>
      <h2>Add ideas to the list</h2>
      <div class="input-wrapper">
        <label for="edit-idea">Select ideas to add</label>
        <div class="select">
          <Select
            isClearable={false}
            items={loadedIdeas}
            bind:value={selectedIdeas}
            placeholder="Select hypothesis"
            isMulti={true}
          />
        </div>
      </div>
      {#if selectedIdeas}
        <div class="ideas-list">
          {#each selectedIdeas as idea}
            <Idea
              idea={$ideas.filter((ideaObj) => ideaObj.id == idea.value)[0]}
            />
          {/each}
        </div>
      {/if}

      <div class="buttons">
        <button
          on:click={() => {
            addNewList({
              author,
              slug,
              title,
              description,
              source,
              image_link,
              user: $user.id,
            });
          }}
        >
          Submit list
        </button>
      </div>
    {/if}
  </div>
</div>

<Footer />

<style>
  .buttons {
    display: flex;
    justify-content: center;
  }

  button {
    border: 1px solid #ccc;
    border-radius: 0.5em;
    margin: 0;
    width: 50%;
  }

  button:hover {
    background-color: #dedede;
  }

  .description-preview {
    font-size: 0.7em;
    line-height: 1em;
    margin-bottom: 1em;
    padding: 0.5em;
    border: 1px solid #ccc;
  }

  .description-preview > p {
    margin: 0;
    margin-top: -0.9em;
    background-color: white;
    display: block;
    max-width: 11em;
    text-align: center;
    color: #666;
    font-style: italic;
    margin-bottom: 0.5em;
  }

  .expander-top {
    display: flex;
    align-items: center;
    column-gap: 0.4em;
    justify-content: space-between;
    margin-bottom: 0.3em;
  }

  .expander {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5em;
    column-gap: 0.5em;
    background-color: #eee;
    padding: 0.5em;
    border-radius: 0.5em;
  }
  .expander-top > label {
    width: 100%;
    margin: auto 0;
  }

  .expander .checkbox {
    padding: 0;
    border: 0;
    appearance: none;
  }

  label {
    padding-top: 0.2em;
  }

  .checkbox:after {
    content: "";
    display: block;
    width: 1em;
    height: 1em;
    border-radius: 0.5em;
    margin: auto;
    background-image: url("/images/arrow-up.png");
    background-size: 50%;
    background-repeat: no-repeat;
    background-position: center;
    transform: rotate(180deg);
    cursor: pointer;
  }

  .checkbox:checked:after {
    transform: rotate(0deg);
  }

  .checkbox:hover:after {
    opacity: 0.5;
  }

  :global(.description-preview > h1, .description-preview
      > h2, .description-preview > h3, .description-preview
      > h4, .description-preview > h5, .description-preview > h6) {
    margin-top: 5px;
    font-size: 1.4em;
    line-height: 1.6em;
  }

  .cols-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: center;
    max-width: 800px;
    padding: 1rem;
    position: relative;
    margin: 0 auto 0 auto;
  }

  button {
    margin: 10px;
    padding: 10px;
  }

  .add-idea-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    max-width: 700px;
  }

  .input-wrapper {
    display: flex;
    flex-direction: row;
    margin: 2px;
    width: 100%;
  }

  input,
  textarea {
    border: 1px solid #ccc;
    border-radius: 0.2em;
    margin: 0;
    padding: 0.5em;
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

  label {
    font-size: 0.7em;
    line-height: 1em;
    padding-right: 0.5em;
    font-style: none;
    width: 30%;
  }

  @media (max-width: 768px) {
    .cols-wrapper {
      padding: 1rem;
      margin: 0;
      z-index: 0;
    }

    .input-wrapper {
      flex-direction: column;
    }

    .input-wrapper input,
    .input-wrapper textarea,
    .input-wrapper label,
    .input-wrapper .select {
      width: 100%;
    }
  }
</style>
