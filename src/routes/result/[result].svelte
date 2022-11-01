<script>
  import { supabase } from "$lib/db";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Footer from "$lib/Footer.svelte";
  import { ideas, nodes, comments, loadingm results } from "$lib/stores";
  import DataLoader from "$lib/DataLoader.svelte";

  const resultSlug = $page.params.result;
</script>

<DataLoader />

<Nav />
