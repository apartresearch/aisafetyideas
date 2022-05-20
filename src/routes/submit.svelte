<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";
  import Nav from "../lib/Nav.svelte";

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
    shownIdeas = [];

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
    idea_id = 0;

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

    console.log(ideas[9]);

    idea_id = Math.max(...ideas.map((idea) => idea.id)) + 1;
  };

  const getTable = async (table_name) => {
    try {
      let { data, error } = await supabase.from(table_name).select("*");
      return data.map((elm) => ({
        ...elm,
        value: elm.title,
        label: elm.title,
      }));
    } catch (err) {
      console.log(err);
    }
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
  };

  const resetData = () => {
    getTables();
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
  };

  const editIdea = (id) => {
    let idea = ideas.find((idea) => idea.id == id);
    if (idea) {
      console.log(idea);
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
    } else {
      resetData();
      editWarning = "Idea not found";
    }
  };

  const deleteIdea = (id) => {
    let idea = ideas.find((idea) => idea.id == id);
    if (idea) {
      supabase
        .from("ideas")
        .delete()
        .match({ id: idea_id })
        .then(() => {
          resetData();
          editWarning = "Idea deleted";
        })
        .catch((err) => {
          console.log(err);
        });
    }
  };
</script>

<Nav />

<div class="cols-wrapper">
  <!-- <div class="col-parent"> -->
  <div class="add-idea-wrapper">
    <h2>Insert idea</h2>
    <div class="input-wrapper">
      <label for="id">ID</label>
      <input type="number" bind:value={idea_id} on:input={editIdea(idea_id)} />
    </div>
    <div class="input-wrapper">
      <label for="author">Author</label>
      <input type="text" bind:value={author} />
    </div>
    <div class="input-wrapper">
      <label for="title">Title</label>
      <input type="text" bind:value={title} />
    </div>
    <div class="input-wrapper description">
      <label for="description"
        >Description (supports <a
          target="_blank"
          href="https://adamvleggett.github.io/drawdown/"
        >
          markdown</a
        >)</label
      >
      <textarea rows="8" bind:value={description} />
    </div>
    <div class="input-wrapper">
      <label for="sourced"> Source link (leave blank if not sourced) </label>
      <input type="text" bind:value={sourced} />
    </div>
    <div class="input-wrapper">
      <label for="tags">Category tags</label>
      <Select items={categories} bind:value={tags} isMulti={true} />
    </div>
    <div class="input-wrapper">
      <label for="superprojects">Superprojects</label>
      <Select
        items={superprojects}
        bind:value={superprojects_ids}
        isMulti={true}
      />
    </div>
    <div class="input-wrapper">
      <label for="related_ideas">Related problems</label>
      <Select items={problems} bind:value={problem_ids} isMulti={true} />
    </div>
    <div class="input-wrapper">
      <label for="filtered">Related ideas</label>
      <Select items={ideas} bind:value={related_ideas} isMulti={true} />
    </div>
    <div class="input-wrapper">
      <label for="verified">Filtered</label>
      <input type="checkbox" bind:checked={filtered} />
      <label for="verified">Verified</label>
      <input type="checkbox" bind:checked={verified} />
    </div>
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

<style>
  .cols-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: center;
    max-width: 1100px;
    margin: 75px auto;
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
    flex-wrap: wrap;
  }
  .input-wrapper input,
  .input-wrapper textarea,
  .input-wrapper Select {
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
  }
</style>
