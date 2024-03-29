<script>
  import { supabase, getTable, uploadIdea } from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import Nav from "$lib/Nav.svelte";
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import Footer from "$lib/Footer.svelte";
  import { user } from "$lib/stores";
  import UserLogin from "$lib/UserLogin.svelte";

  let ideas = [],
    nodes = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    nodeIdeaRelations = [],
    problemRelations = [],
    ideaRelations = [],
    currentIdea = {},
    loaded = false,
    selectedCategories = [],
    shownIdeas = [],
    ideaSelect = [],
    selectedIdea = {},
    isHypothesis = false,
    career_difficulty = {
      value: 3,
      label: "Graduate",
    },
    importanceLevel = {
      value: "3",
      label: "3: Will inform others' work",
    },
    importance = null,
    project_factory = process.env.PROJECT_FACTORY == "TRUE";

  const careerDiffStages = [
    {
      value: "1",
      label: "High school",
    },
    {
      value: "2",
      label: "Undergrad",
    },
    {
      value: "3",
      label: "Graduate",
    },
    {
      value: "4",
      label: "Postdoc",
    },
    {
      value: "5",
      label: "Professor",
    },
  ];

  const importanceLevels = [
    {
      value: 1,
      label: "1: Useful as a learning project",
    },
    {
      value: 2,
      label: "2: Might interest researchers",
    },
    {
      value: 3,
      label: "3: Will inform others' work",
    },
    {
      value: 4,
      label: "4: Can inform a new research agenda",
    },
    {
      value: 5,
      label: "5: Might create a paradigm shift",
    },
  ];

  let author = "",
    title = "",
    description = "",
    sourced = "",
    tags = [],
    nodes_ids = [],
    related_ideas = [],
    problem_ids = [],
    filtered = false,
    verified = false,
    idea_id = 0,
    date_sourced = "",
    difficulty = null,
    funding_amount = 0,
    funding_currency = "$",
    funding_from = "",
    mentorship_from = "",
    authorContact = "";

  let editWarning = "",
    showSourceInput = false,
    showFundingInput = false,
    showMentorshipInput = false,
    retainInfo = false;

  onMount(async () => getTables());

  const getTables = async () => {
    [
      ideas,
      nodes,
      categories,
      problems,
      categoryRelations,
      nodeIdeaRelations,
      problemRelations,
      ideaRelations,
    ] = await Promise.all([
      getTable("ideas"),
      getTable("nodes"),
      getTable("categories"),
      getTable("problems"),
      getTable("idea_category_relation"),
      getTable("nodes_ideas"),
      getTable("idea_problem_relation"),
      getTable("idea_idea_relation"),
    ]);

    ideas.forEach((idea) => {
      idea.categories = categoryRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.nodes = nodeIdeaRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.problems = problemRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.ideas = ideaRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.categories.forEach((category) => {
        category.category = categories.find(
          (cat) => cat.id === category.category
        );
      });
      idea.nodes.forEach((node) => {
        node.node = nodes.find((sp) => sp.id === node.node);
      });
      idea.problems.forEach((problem) => {
        problem.problem = problems.find((p) => p.title === problem.problem);
      });
      idea.shown = true;
    });

    categories = categories.filter((category) => !category.project_factory);

    idea_id = Math.max(...ideas.map((idea) => idea.id)) + 1;
    if ($user.expert) {
      ideaSelect = ideas.map((idea) => {
        return {
          value: idea.id,
          label: idea.title,
        };
      });
    } else {
      ideaSelect = ideas
        .filter((idea) => idea.user == $user.id)
        .map((idea) => {
          return {
            value: idea.id,
            label: idea.title,
          };
        });
      console.log(ideaSelect);
    }
    ideaSelect = [...ideaSelect, { value: idea_id, label: "New Idea" }];
    selectedIdea = ideaSelect[ideaSelect.length - 1];
  };

  const addNewIdea = async (
    idea,
    categories_ids,
    nodes_ids,
    problems_ids,
    ideas_ids
  ) => {
    try {
      alert(`Your idea is now under review to ensure nothing breaks. Thank you for submitting! It will be live on the website soon (maximum 3 days).\n
      "${idea.title}".`);
      // Delete existing relations
      if (ideas.find((idea) => idea.id === idea_id)) {
        await Promise.all([
          supabase.from("idea_category_relation").delete().match({
            idea: idea_id,
          }),
          // supabase.from("idea_user_likes").delete().match({ idea: idea_id }),
          supabase.from("nodes_ideas").delete().match({
            idea: idea_id,
          }),
          supabase.from("idea_problem_relation").delete().match({
            idea: idea_id,
          }),
          supabase.from("idea_idea_relation").delete().match({
            parent: idea_id,
          }),
          supabase.from("idea_idea_relation").delete().match({
            child: idea_id,
          }),
        ]);
      }

      // Add idea and replace if it exists
      const { data, error } = await supabase.from("ideas").upsert(idea);
      if (error) {
        console.log(error);
        return;
      }

      console.log("Uploaded idea...", idea);
      await categories_ids.forEach(async (category_id) => {
        await supabase.from("idea_category_relation").insert(category_id);
      });
      console.log("Uploaded categories relations...");
      await nodes_ids.forEach(async (node_id) => {
        await supabase.from("nodes_ideas").insert(node_id);
      });
      console.log("Uploaded nodes relations...");
      await problems_ids.forEach(async (problem_id) => {
        await supabase.from("idea_problem_relation").insert(problem_id);
      });
      console.log("Uploaded problems relations...");
      await ideas_ids.forEach(async (idea_id) => {
        await supabase.from("idea_idea_relation").insert(idea_id);
      });
      console.log("Uploaded idea relations...");

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
    tags = [];
    related_ideas = [];
    problem_ids = [];
    idea_id = Math.max(...ideas.map((idea) => idea.id)) + 1;
    difficulty = 0;
    funding_amount = 0;
    funding_currency = "$";
    if (!retainInfo) {
      author = "";
      sourced = "";
      nodes_ids = [];
      filtered = false;
      verified = false;

      date_sourced = "";
      funding_from = "";
      mentorship_from = "";
      authorContact = "";
    }
  };

  const editIdea = (id) => {
    let idea = ideas.find((idea) => idea.id == id);
    if (idea) {
      author = idea.author;
      title = idea.title;
      description = idea.summary;
      sourced = idea.sourced;
      tags = idea.categories.map((category) => category.category);
      nodes_ids = idea.nodes[0] ? idea.nodes.map((node) => node.node) : [];
      related_ideas = idea.related_ideas;
      filtered = idea.filtered;
      verified = idea.verified;
      problem_ids = idea.problems;
      career_difficulty = careerDiffStages.find(
        (cd) => cd.value == idea.career_difficulty
      );
      importanceLevel = importanceLevels.find(
        (il) => il.value == idea.importance
      );
      difficulty = idea.difficulty;
      funding_amount = idea.funding_amount;
      funding_currency = idea.funding_currency;
      funding_from = idea.funding_from;
      mentorship_from = idea.mentorship_from;
      currentIdea = idea;
      authorContact = idea.contact;
      date_sourced = idea.from_date;
    } else {
      resetData(false);
      editWarning = "Editing core";
    }
  };

  $: {
    idea_id = selectedIdea.value;
    editIdea(idea_id);
  }

  $: {
    importance = importanceLevel.value;
  }

  const deleteIdea = async (id) => {
    Promise.all([
      supabase.from("idea_category_relation").delete().match({ idea: id }),
      supabase.from("idea_user_likes").delete().match({ idea: id }),
      supabase.from("nodes_ideas").delete().match({ idea: id }),
      supabase.from("idea_problem_relation").delete().match({ idea: id }),
      supabase.from("idea_idea_relation").delete().match({ parent: id }),
      supabase.from("idea_idea_relation").delete().match({ child: id }),
      supabase.from("idea_user_interest_relation").delete().match({
        idea: id,
      }),
    ]);
    await supabase.from("ideas").delete().match({ id });
    resetData();
  };

  let password = "";
</script>

<svelte:head>
  <title>Submit idea | AI safety ideas</title>
</svelte:head>

<Nav />

<div class="cols-wrapper">
  <!-- <div class="col-parent"> -->

  <div class="add-idea-wrapper">
    <h2>Send in an idea</h2>
    {#if !$user}
      <div class="login-warning">
        <p>Please login to submit an idea.</p>
        <UserLogin />
      </div>
    {:else}
      <div class="input-wrapper">
        <label for="verified"> This is a hypothesis </label>
        <input type="checkbox" bind:checked={isHypothesis} />
      </div>
      {#if ideaSelect.length > 0}
        <div class="input-wrapper">
          <label for="edit-idea">Edit idea</label>
          <div class="select">
            <Select
              isClearable={false}
              items={ideaSelect}
              bind:value={selectedIdea}
              placeholder="Select idea to edit..."
            />
          </div>
        </div>
        {#if $user.expert}
          <div class="input-wrapper">
            <label for="id">ID</label>
            <input type="number" disabled bind:value={idea_id} />
          </div>
        {/if}
      {/if}
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
      {#if description != ""}
        <div class="description-preview">
          <p>Description preview</p>
          {@html markdown(description)}
        </div>
      {/if}

      <div class="input-wrapper">
        <label for="tags">Category tags</label>
        <div class="select">
          <Select
            isClearable={false}
            items={categories}
            bind:value={tags}
            isMulti={true}
          />
        </div>
      </div>
      <div class="input-wrapper">
        <label for="lists">Lists</label>
        <div class="select">
          <Select
            isClearable={false}
            items={nodes}
            bind:value={nodes_ids}
            isMulti={true}
          />
        </div>
      </div>
      <!-- <div class="input-wrapper">
        <label for="related_ideas">Related problems</label>
        <div class="select">
          <Select items={problems} bind:value={problem_ids} isMulti={true} />
        </div>
      </div>-->
      <div class="input-wrapper">
        <label for="filtered">Related ideas</label>
        <div class="select">
          <Select items={ideas} bind:value={related_ideas} isMulti={true} />
        </div>
      </div>
      <div class="input-wrapper">
        <label for="2">Difficulty level</label>
        <div class="select">
          <Select
            isClearable={false}
            items={careerDiffStages}
            bind:value={career_difficulty}
          />
        </div>
      </div>
      <div class="input-wrapper">
        <label for="2">How important does this seem</label>
        <div class="select">
          <Select
            isClearable={false}
            items={importanceLevels}
            bind:value={importanceLevel}
          />
        </div>
      </div>
      <div class="input-wrapper">
        <label for="difficulty">Estimated hours of work necessary</label>
        <input type="number" bind:value={difficulty} min="0" />
      </div>
      <h3>Source & funding</h3>

      <div class="expander">
        <div class="expander-top">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={showSourceInput}
          />
          <!-- svelte-ignore a11y-label-has-associated-control -->
          <label>This idea is from someone else</label>
        </div>
        {#if showSourceInput}
          <div class="input-wrapper">
            <label for="author">Author</label>
            <input type="text" bind:value={author} />
          </div>
          <div class="input-wrapper">
            <label
              for="author-contact"
              use:tippy={{
                content:
                  "If you write your email, then remember that it will be publicly displayed.",
              }}>Author email</label
            >
            <input type="email" bind:value={authorContact} />
          </div>
          <div class="input-wrapper">
            <label for="sourced"> Source link </label>
            <input type="text" bind:value={sourced} />
          </div>
          <div class="input-wrapper">
            <label
              for="date_sourced"
              use:tippy={{ content: "When was the sourced idea written?" }}
            >
              Source date
            </label>
            <input type="date" bind:value={date_sourced} />
          </div>
        {/if}
      </div>
      <div class="expander">
        <div class="expander-top">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={showFundingInput}
          />
          <label>Funding is available for this idea</label>
        </div>
        {#if showFundingInput}
          <div class="input-wrapper">
            <label for="funding_amount">Funding available</label>
            <input
              type="number"
              bind:value={funding_amount}
              use:tippy={{
                content:
                  "If funding exists, how much is available? Leave blank if funding is not available.",
              }}
            />
          </div>
          <div class="input-wrapper">
            <label for="funding_currency">Currency</label>
            <input
              type="text"
              bind:value={funding_currency}
              use:tippy={{
                content:
                  "If funding exists, what is the currency? Leave blank if funding is not available.",
              }}
            />
          </div>
          <div class="input-wrapper">
            <label for="funding_from">Funding source URL</label>
            <input
              type="url"
              bind:value={funding_from}
              use:tippy={{
                content:
                  "If funding exists, from whom is the funding available? Input as URL. Leave blank if funding is not available.",
              }}
            />
          </div>
        {/if}
      </div>
      <div class="expander">
        <div class="expander-top">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={showMentorshipInput}
          />
          <label>Mentorship is available for this idea</label>
        </div>
        {#if showMentorshipInput}
          <div class="input-wrapper">
            <label for="mentorship_from">Mentorship available URL</label>
            <input
              type="url"
              bind:value={mentorship_from}
              use:tippy={{
                content:
                  "If mentorship is available, from whom is the mentorship available? Input as URL. Leave blank if mentorship is not available.",
              }}
            />
          </div>
        {/if}
      </div>
      <!-- <div class="input-wrapper">
        <label for="status">Admin access</label>
        <input
          type="password"
          bind:value={password}
          placeholder="Input admin password to edit and review ideas"
        />
      </div> -->
      {#if $user.expert}
        <div class="input-wrapper">
          <label for="verified">
            Don't reset relevant variables when submitting
          </label>
          <input type="checkbox" bind:checked={retainInfo} />
        </div>
        <div class="input-wrapper">
          <label for="verified">Filtered</label>
          <input type="checkbox" bind:checked={filtered} />
        </div>
        <div class="input-wrapper">
          <label for="verified">Verified</label>
          <input type="checkbox" bind:checked={verified} />
        </div>
        <div class="input-wrapper">
          <label for="verified">Project factory idea?</label>
          <input type="checkbox" bind:checked={project_factory} />
        </div>
      {/if}
      <div class="buttons">
        <button
          on:click={() => {
            addNewIdea(
              {
                id: idea_id,
                author,
                title,
                summary: description,
                verified_by_expert: verified,
                filtered,
                sourced: sourced,
                difficulty,
                hypothesis: isHypothesis,
                from_date:
                  date_sourced != '""' &&
                  date_sourced != "" &&
                  date_sourced != undefined
                    ? date_sourced
                    : null,
                funding_amount,
                funding_currency,
                funding_from,
                mentorship_from,
                career_difficulty: career_difficulty.value,
                contact: authorContact,
                user: $user.id,
                project_factory: project_factory ? "TRUE" : "FALSE",
                importance,
              },
              tags
                ? tags.map((tag) => ({ category: tag.id, idea: idea_id }))
                : [],
              nodes_ids
                ? nodes_ids.map((elm) => ({
                    node: elm.id,
                    idea: idea_id,
                  }))
                : [],
              problem_ids
                ? problem_ids.map((elm) => ({
                    problem: elm.id,
                    idea: idea_id,
                  }))
                : [],
              related_ideas
                ? related_ideas.map((elm) => ({
                    parent: idea_id,
                    child: elm.id,
                  }))
                : []
            );
          }}
        >
          Submit idea
        </button>
        {#if $user.expert}
          <button on:click={deleteIdea(idea_id)}> Delete selected idea </button>
        {/if}
        <!-- </div> -->
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
