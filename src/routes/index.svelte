<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";

  onMount(async () => {
    ideas = await getTable("ideas");
    superprojects = await getTable("idea_superprojects");
    categories = await getTable("idea_categories");
    problems = await getTable("problems");
  });
</script>

<h2>See ideas</h2>
{#each ideas as idea}
  <i>{idea.author}</i><br />
  <b>{idea.title}</b><br />
  {@html markdown(idea.summary)}
{:else}
  <p>No ideas found</p>
{/each}

<style>
</style>
