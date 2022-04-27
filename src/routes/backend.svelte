<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";

  let ideas = [];
  let superprojects = [];
  let categories = [];
  let ideaTitle = "";
  let session = null;

  onMount(async () => {
    await getAllIdeas();
    await getAllSuperprojects();
    await getAllCategories();
  });

  const getTable = async (table_name) => {
    try {
      let { data, error } = await supabase.from("table_name").select("*");
      return data;
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

  const handleSelect = () => {
    console.log(select.value);
  };
</script>

<Select items={categories} on:select={handleSelect} isMulti={true} />
<Select items={superprojects} on:select={handleSelect} isMulti={true} />
<Select items={problems} on:select={handleSelect} isMulti={true} />
