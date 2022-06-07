<script>
  import { supabase, getTable, setupIdeas } from "$lib/db";
  import { page } from "$app/stores";
  console.log(page);
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  const user_slug = $page.params.user;

  //   Load user information
  let user = {};

  onMount(async () => {
    [user] = await Promise.all([getTable("users").find(user_slug)]);
  });
</script>

<!-- Edit username -->
