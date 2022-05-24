<script>
  import { supabase, getTable } from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import Nav from "$lib/Nav.svelte";
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import Footer from "$lib/Footer.svelte";

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [],
    currentIdea = {},
    loaded = false,
    selectedCategories = [],
    shownIdeas = [],
    ideaSelect = [],
    selectedIdea = {};

  let author = "",
    title = "",
    description = "",
    sourced = "",
    tags = [],
    superprojects_ids = [],
    related_ideas = [],
    problem_ids = [],
    filtered = false,
    verified = false,
    idea_id = 0,
    date_sourced = "",
    difficulty = 0,
    funding_amount = 0,
    funding_currency = "$",
    funding_from = "",
    mentorship_from = "",
    authorContact = "";

  let editWarning = "";

  onMount(async () => getTables());

  const getTables = async () => {
    [
      ideas,
      superprojects,
      categories,
      problems,
      categoryRelations,
      superprojectRelations,
      problemRelations,
      ideaRelations,
    ] = await Promise.all([
      getTable("ideas"),
      getTable("superprojects"),
      getTable("categories"),
      getTable("problems"),
      getTable("idea_category_relation"),
      getTable("idea_superproject_relation"),
      getTable("idea_problem_relation"),
      getTable("idea_idea_relation"),
    ]);

    ideas.forEach((idea) => {
      idea.categories = categoryRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.superprojects = superprojectRelations.filter(
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
      idea.superprojects.forEach((superproject) => {
        superproject.superproject = superprojects.find(
          (sp) => sp.id === superproject.superproject
        );
      });
      idea.problems.forEach((problem) => {
        problem.problem = problems.find((p) => p.title === problem.problem);
      });
      idea.shown = true;
    });

    idea_id = Math.max(...ideas.map((idea) => idea.id)) + 1;
    ideaSelect = ideas.map((idea) => {
      return {
        value: idea.id,
        label: idea.title,
      };
    });
    ideaSelect = [...ideaSelect, { value: idea_id, label: "New Idea" }];
    selectedIdea = ideaSelect[ideaSelect.length - 1];
  };

  const addNewIdea = async (
    idea,
    categories_ids,
    superprojects_ids,
    problems_ids,
    ideas_ids
  ) => {
    try {
      // Delete existing relations
      await supabase
        .from("idea_category_relation")
        .delete()
        .match({ idea: idea.id });
      await supabase
        .from("idea_superproject_relation")
        .delete()
        .match({ idea: idea.id });
      await supabase
        .from("idea_problem_relation")
        .delete()
        .match({ idea: idea.id });
      await supabase
        .from("idea_idea_relation")
        .delete()
        .match({ idea_1: idea.id });

      // Add idea and replace if id exists
      const { data, error } = await supabase.from("ideas").upsert(idea);
      console.log("Uploaded idea...");
      await categories_ids.forEach(async (category_id) => {
        await supabase.from("idea_category_relation").insert(category_id);
      });
      console.log("Uploaded categories relations...");
      await superprojects_ids.forEach(async (superproject_id) => {
        await supabase
          .from("idea_superproject_relation")
          .insert(superproject_id);
      });
      console.log("Uploaded superprojects relations...");
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
      console.log(err);
    }
    resetData();
  };

  const resetData = (reload = true) => {
    if (reload) getTables();
    author = "";
    title = "";
    description = "";
    sourced = "";
    tags = [];
    superprojects_ids = [];
    related_ideas = [];
    filtered = false;
    verified = false;
    problem_ids = [];
    idea_id = Math.max(...ideas.map((idea) => idea.id)) + 1;
    date_sourced = "";
    difficulty = 0;
    funding_amount = 0;
    funding_currency = "$";
    funding_from = "";
    mentorship_from = "";
    authorContact = "";
  };

  const editIdea = (id) => {
    let idea = ideas.find((idea) => idea.id == id);
    if (idea) {
      author = idea.author;
      title = idea.title;
      description = idea.summary;
      sourced = idea.sourced;
      tags = idea.categories.map((category) => category.category);
      superprojects_ids = idea.superprojects[0]
        ? idea.superprojects.map((superproject) => superproject.superproject)
        : [];
      related_ideas = idea.related_ideas;
      filtered = idea.filtered;
      verified = idea.verified;
      problem_ids = idea.problems;
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

  const deleteIdea = async (id) => {
    let idea = ideas.find((idea) => idea.id == id);

    Promise.all([
      supabase.from("idea_category_relation").delete().match({ idea: id }),
      supabase.from("idea_superproject_relation").delete().match({ idea: id }),
      supabase.from("idea_problem_relation").delete().match({ idea: id }),
      supabase.from("idea_idea_relation").delete().match({ idea_1: id }),
      supabase.from("idea_idea_relation").delete().match({ idea_2: id }),
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
    <div class="input-wrapper">
      <input
        type="password"
        bind:value={password}
        placeholder="Input admin password"
      />
    </div>
    <h2>Insert idea</h2>
    {#if password == process.env.ADMIN_PASSWORD}
      <div class="input-wrapper">
        <label for="edit-idea">Edit idea</label>
        <div class="select">
          <Select
            items={ideaSelect}
            bind:value={selectedIdea}
            placeholder="Select idea to edit..."
          />
        </div>
      </div>
      <div class="input-wrapper">
        <label for="id">ID</label>
        <input
          type="number"
          disabled
          bind:value={idea_id}
          on:input={editIdea(idea_id)}
        />
      </div>
    {/if}
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
        <Select items={categories} bind:value={tags} isMulti={true} />
      </div>
    </div>
    <div class="input-wrapper">
      <label for="superprojects">Superprojects</label>
      <div class="select">
        <Select
          items={superprojects}
          bind:value={superprojects_ids}
          isMulti={true}
        />
      </div>
    </div>
    <div class="input-wrapper">
      <label for="related_ideas">Related problems</label>
      <div class="select">
        <Select items={problems} bind:value={problem_ids} isMulti={true} />
      </div>
    </div>
    <div class="input-wrapper">
      <label for="filtered">Related ideas</label>
      <div class="select">
        <Select items={ideas} bind:value={related_ideas} isMulti={true} />
      </div>
    </div>
    <div class="input-wrapper">
      <label for="difficulty">Difficulty of task ({difficulty})</label>
      <input
        type="range"
        bind:value={difficulty}
        min="0"
        max="5"
        use:tippy={{
          content: `Difficulty of task. 
            0: Blog post.
            1: Undergraduate exam.
            3: Master's thesis. 
            5: Expert working for 5 years`,
        }}
      />
    </div>
    <h3>Source & funding</h3>
    <div class="input-wrapper">
      <label for="sourced"> Source link (leave blank if not sourced) </label>
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
    {#if password == process.env.ADMIN_PASSWORD}
      <div class="input-wrapper">
        <label for="verified">Filtered</label>
        <input type="checkbox" bind:checked={filtered} />
        <label for="verified">Verified</label>
        <input type="checkbox" bind:checked={verified} />
      </div>
    {/if}
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
            from_date: date_sourced,
            funding_amount,
            funding_currency,
            funding_from,
            mentorship_from,
            contact: authorContact,
          },
          tags ? tags.map((tag) => ({ category: tag.id, idea: idea_id })) : [],
          superprojects_ids
            ? superprojects_ids.map((elm) => ({
                superproject: elm.id,
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
                idea_1: idea_id,
                idea_2: elm.id,
              }))
            : []
        );
      }}
    >
      Submit idea
    </button>
    <button on:click={deleteIdea(idea_id)}> Delete selected idea </button>
    <!-- </div> -->
  </div>
</div>

<Footer />

<style>
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
    max-width: 1100px;
    margin: 1em auto;
    margin-top: 3em;
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
    max-width: 500px;
  }
  .input-wrapper {
    display: flex;
    flex-direction: row;
    margin: 2px;
    width: 100%;
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
      padding: 0 10px;
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
