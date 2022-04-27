<script>
  import { goto } from "$app/navigation";

  import supabase from "$lib/db";
  import { user } from "$lib/stores";
  import Todo from "$lib/Todo.svelte";
  import { onMount } from "svelte";

  let ideas = [];
  let superprojects = [];
  let categories = [];
  let ideaTitle = "";
  let session = null;

  onMount(async () => {
    console.log($user);
    await getAllIdeas();
    await getAllSuperprojects();
    await getAllCategories();
  });

  let emailInput = "";
  let passwordInput = "";

  const getAllIdeas = async () => {
    try {
      let { data, error } = await supabase.from("ideas").select("*");
      ideas = data;
    } catch (err) {
      console.log(err);
    }
  };

  const addNewIdea = async (title) => {
    try {
      const { data, error } = await supabase
        .from("ideas")
        .insert([{ task: newTask, user_id: "22" }]);
      await getAllIdeas();
      newTask = "";
    } catch (err) {
      console.log(err);
    }
  };

  const updateIdea = async (idea) => {
    try {
      const { data, error } = await supabase
        .from("ideas")
        .update({ task: idea.task, isComplete: idea.isComplete })
        .eq("id", idea.id);
      await getAllIdeas();
    } catch (err) {
      console.log(err);
    }
  };

  const getAllSuperprojects = async () => {
    try {
      let { data, error } = await supabase
        .from("idea_superprojects")
        .select("*");
      superprojects = data;
    } catch (err) {
      console.log(err);
    }
  };

  const getAllCategories = async () => {
    try {
      let { data, error } = await supabase.from("idea_categories").select("*");
      superprojects = data;
    } catch (err) {
      console.log(err);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && newTask !== "") {
      addNewTodo();
    }
  };
</script>

<div class="add-todo">
  <input type="text" bind:value={ideaTitle} />
  <button on:click={() => addNewIdea()}>Submit idea</button>
</div>

{#each ideas as idea}
  <p>IDEA HERE WOW! {JSON.stringify(idea)}</p>
{:else}
  <p>No ideas found</p>
{/each}

<svelte:window on:keypress={handleKeyPress} />

<style>
</style>
