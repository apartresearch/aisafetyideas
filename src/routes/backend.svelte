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
      const { data, error } = await supabase.from("ideas").insert(idea);
      await categories_ids.forEach(async (category_id) => {
        await supabase.from("idea_category_relation").insert(idea);
      });
      await superprojects_ids.forEach(async (superproject_id) => {
        await supabase.from("idea_superproject_relation").insert({
          idea: idea.id,
          superproject: superproject_id,
        });
      });
      await problems_ids.forEach(async (problem_id) => {
        await supabase.from("idea_problem_relation").insert(
          {
            idea: idea.id,
            problem: problem_id,
          },
          {
            conflict: "update",
          }
        );
      });
      await ideas_ids.forEach(async (idea_id) => {
        await supabase.from("idea_idea_relation").insert({
          idea_1: idea.id,
          idea_2: idea_id,
        });
      });
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
    tags = [],
    superprojects_ids = [],
    related_ideas = [],
    filtered = true,
    verified = true,
    problem_ids = [];

  const resetData = () => {
    author = "";
    title = "";
    description = "";
    tags = [];
    superprojects_ids = [];
    related_ideas = [];
    filtered = true;
    verified = true;
    problem_ids = [];
  };
</script>

<div class="add-idea-wrapper">
  <h2>Insert idea</h2>
  <div class="input-wrapper">
    <label for="author">Author</label>
    <input type="text" bind:value={author} />
  </div>
  <div class="input-wrapper">
    <label for="title">Title</label>
    <input type="text" bind:value={title} />
  </div>
  <div class="input-wrapper">
    <label for="description">Description</label>
    <input type="text" bind:value={description} height="300px" />
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
</div>

<button
  on:click={() =>
    addNewIdea(
      {
        author,
        title,
        summary: description,
        verified,
        filtered,
        tags: tags.map((tag) => tag.id),
      },
      tags,
      superprojects_ids,
      problem_ids,

      related_ideas
    )}>Submit idea</button
>

<style>
  .add-idea-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 500px;
    height: 100%;
  }
  .input-wrapper {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
    width: 100%;
  }
  .input-wrapper label {
    margin-bottom: 5px;
  }
  .input-wrapper input {
    margin-bottom: 5px;
  }
</style>
