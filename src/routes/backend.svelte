<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [];

  onMount(async () => {
    ideas = await getTable("ideas");
    superprojects = await getTable("idea_superprojects");
    categories = await getTable("idea_categories");
    problems = await getTable("problems");
  });

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
      console.table(idea);
      const { data, error } = await supabase.from("ideas").insert(idea);
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

  const handleSelect = () => {
    console.log(select.value);
  };

  let author = "",
    title = "",
    description = "",
    sourced = "",
    tags = [],
    superprojects_ids = [],
    related_ideas = [],
    filtered = true,
    verified = true,
    problem_ids = [],
    idea_id = parseInt(Math.random() * 1e10);

  const resetData = () => {
    author = "";
    title = "";
    description = "";
    sourced = "";
    tags = [];
    superprojects_ids = [];
    related_ideas = [];
    filtered = true;
    verified = true;
    problem_ids = [];
    idea_id = parseInt(Math.random() * 1e10);
  };

  const editIdea = (idea) => {
    idea_id = idea.id;
    author = idea.author;
    title = idea.title;
    description = idea.description;
    tags = idea.tags;
    superprojects_ids = idea.superprojects_ids;
    related_ideas = idea.related_ideas;
    filtered = idea.filtered;
    verified = idea.verified;
    problem_ids = idea.problem_ids;
  };
</script>

<div class="cols-wrapper">
  <div class="col-parent">
    <div class="add-idea-wrapper">
      <h2>Insert idea</h2>
      <div class="input-wrapper">
        <label for="id">ID</label>
        <input type="number" disabled bind:value={idea_id} />
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
        <label for="description">Description (supports markdown)</label>
        <textarea rows="8" bind:value={description} />
      </div>
      <div class="input-wrapper">
        <label for="sourced"> Source link (leave blank if not sourced) </label>
        <input type="text" bind:value={sourced} />
      </div>
      <div class="input-wrapper">
        <label for="tags">Tags</label>
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
            tags.map((elm) => ({
              idea: idea_id,
              category: elm.title,
            })),
            superprojects_ids.map((elm) => ({
              superproject: elm.title,
              idea: idea_id,
            })),
            problem_ids.map((elm) => ({
              problem: elm.title,
              idea: idea_id,
            })),
            related_ideas.map((elm) => ({
              idea_1: idea_id,
              idea_2: elm.id,
            }))
          );
        }}
      >
        Submit idea
      </button>
    </div>
  </div>
  <div class="col-parent">
    <h2>See ideas</h2>
    {#each ideas as idea}
      <i>{idea.author}</i><br />
      <b>{idea.title}</b><br />
      {@html markdown(idea.summary)}
    {/each}
    <script defer src="https://cdn.commento.io/js/commento.js"></script>
    <div id="commento" />
  </div>
</div>

<style>
  .cols-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    max-width: 1100px;
    margin: 0 auto;
  }

  .col-parent {
    width: 50%;
    margin: 0 10px;
    vertical-align: top;
  }

  button {
    margin: 10px;
    padding: 10px;
  }

  .add-idea-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .input-wrapper {
    display: flex;
    flex-direction: column;
    margin: 2px;
    width: 100%;
  }
  .input-wrapper input {
    margin-bottom: 5px;
  }

  .description textarea {
    height: 250px;
  }

  label {
    font-size: 18px;
    font-style: none;
  }
</style>
