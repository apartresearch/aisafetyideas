<script>
  import { supabase, getTable } from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import Nav from "$lib/Nav.svelte";
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import Footer from "$lib/Footer.svelte";
  import { user, ideas, loading } from "$lib/stores";
  import UserLogin from "$lib/UserLogin.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Idea from "$lib/Idea.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";

  let loadedIdeas = [],
    ideaSelect = [],
    results = [],
    selectedIdea = {},
    selectedIdeaInfo = {};

  let author = "",
    title = "",
    description = "",
    sourced = "",
    idea_id = 0,
    date_sourced = "",
    image_link = "",
    url = "",
    original = false,
    ideaParam = "",
    hours = 0,
    type = "",
    typeList = [
      { label: "Ambiguous result", value: "ambiguous" },
      { label: "Results support hypothesis", value: "positive" },
      { label: "Results go against hypothesis", value: "negative" },
    ],
    typeSelect = typeList[0];

  let editWarning = "",
    showSourceInput = false,
    retainInfo = false;

  onMount(async () => {
    getTables();
    // Wait until $loading is false
    while ($loading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    url = new URL(window.location.href);
    ideaParam = url.searchParams.get("idea");
    if (ideaParam) {
      selectedIdea = ideaSelect.find((idea) => idea.value == ideaParam);
      selectedIdeaInfo = $ideas.find((idea) => idea.id == ideaParam);
      console.log(ideaParam, selectedIdea);
    }
  });

  const getTables = async () => {
    [loadedIdeas, results] = await Promise.all([
      getTable("ideas"),
      getTable("results"),
    ]);

    ideaSelect = loadedIdeas.map((idea) => {
      return {
        label:
          (idea.hypothesis ? "Hypothesis" : "Project") + " | " + idea.title,
        value: idea.id,
      };
    });
    if (!selectedIdea) {
      selectedIdea = ideaSelect[-1];
    }
  };

  const addNewResult = async (result) => {
    try {
      alert(`Your result is now live!`);

      // Add result and replace if it exists
      const { data, error } = await supabase.from("results").upsert(result);
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
    hours = 0;
    sourced = "";
  };

  $: {
    if (selectedIdea) {
      idea_id = selectedIdea.value;
      selectedIdeaInfo = $ideas.find((idea) => idea.id == idea_id);
    }
  }

  $: {
    type = typeSelect.value;
  }
</script>

<svelte:head>
  <title>Submit result | AI safety ideas</title>
</svelte:head>

<Nav />
<DataLoader />

{#if $loading}
  <LoadIcon />
{:else}
  <div class="cols-wrapper">
    <!-- <div class="col-parent"> -->

    <div class="add-idea-wrapper">
      <h1>Submit a result for a project / hypothesis</h1>
      {#if !$user}
        <div class="login-warning">
          <p>Please login to submit a result / project.</p>
          <UserLogin />
        </div>
      {:else}
        <div class="input-wrapper">
          <label for="edit-idea">Select project / hypothesis</label>
          <div class="select">
            <Select
              isClearable={false}
              items={ideaSelect}
              bind:value={selectedIdea}
              placeholder="Select project"
            />
          </div>
        </div>
        {#if selectedIdeaInfo}
          <Idea idea={selectedIdeaInfo} />
        {/if}

        <h2>Result information</h2>
        <div class="input-wrapper">
          <label for="title">Title</label>
          <input type="text" bind:value={title} maxlength="80" />
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
          <input type="text" bind:value={sourced} />
        </div>
        <div class="input-wrapper">
          <label
            for="sourced"
            use:tippy={{
              content:
                "This image will be used as a cover image for your result. If you don't have an image, you can leave this blank.",
            }}
          >
            Link to main image (optional)
          </label>
          <input type="text" bind:value={image_link} />
        </div>
        {#if selectedIdeaInfo && !selectedIdeaInfo.hypothesis}
          <p class="small">
            <i> Disabled because this project is not a hypothesis. </i>
          </p>
        {/if}
        <div class="input-wrapper">
          <label for="edit-idea">Does the result support the hypothesis?</label>
          <div class="select">
            <Select
              isDisabled={selectedIdeaInfo && !selectedIdeaInfo.hypothesis}
              isClearable={false}
              items={typeList}
              bind:value={typeSelect}
              placeholder="Select type"
            />
          </div>
        </div>
        <div class="input-wrapper">
          <label for="author">Author (if not you)</label>
          <input type="text" bind:value={author} />
        </div>
        <div class="input-wrapper">
          <label for="date_sourced"> Date (if not today) </label>
          <input type="date" bind:value={date_sourced} />
        </div>

        <div class="input-wrapper">
          <label for="verified"> Originally made on aisi.ai </label>
          <input
            type="checkbox"
            bind:checked={original}
            use:tippy={{
              content:
                "Was this result made because you saw the idea on the site? If so, please check this box. If not, please leave it unchecked.",
            }}
          />
        </div>

        <div class="buttons">
          <button
            on:click={() => {
              addNewResult({
                idea: idea_id,
                author,
                title,
                description,
                link: sourced,
                image_link,
                type,
                original,
                from_date:
                  date_sourced != '""' &&
                  date_sourced != "" &&
                  date_sourced != undefined
                    ? date_sourced
                    : new Date(),
                user: $user.id,
              });
            }}
          >
            Submit result
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<IdeaViewer />

<Footer />

<style>
  .small {
    font-size: 0.8em;
    color: #666;
    text-align: right;
  }

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
