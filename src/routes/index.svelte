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
        .from("ideas_superprojects")
        .select("*");
      superprojects = data;
    } catch (err) {
      console.log(err);
    }
  };

  const getAllCategories = async () => {
    try {
      let { data, error } = await supabase.from("ideas_categories").select("*");
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

  const logOut = async () => {
    let { error } = await supabase.auth.signOut();
    goto("/login");
  };

  // const signInWithX = async (X) => {
  //   if (X != "email") {
  //     const {
  //       user: userDetails,
  //       session,
  //       error,
  //     } = await supabase.auth.signIn({
  //       provider: X,
  //     });
  //   } else {
  //     const {
  //       user: userDetails,
  //       session,
  //       error,
  //     } = await supabase.auth.signIn({
  //       email: "",
  //       password: "",
  //     });
  //   }
  //   $user = userDetails;
  // };

  // const signUpWithX = async (X) => {
  //   if (X != "email") {
  //     const {
  //       user: userDetails,
  //       session,
  //       error,
  //     } = await supabase.auth.signUp({
  //       provider: X,
  //     });
  //   } else {
  //     const {
  //       user: userDetails,
  //       session,
  //       error,
  //     } = await supabase.auth.signUp({
  //       email: "",
  //       password: "",
  //     });
  //   }
  //   $user = userDetails;
  // };

  // $: signup = false;
</script>

<h4>Welcome {$user ? $user.email : ""}!</h4>

<div class="add-todo">
  <input type="text" bind:value={ideaTitle} />
  <button on:click={() => addNewIdea()}>Add Task</button>
</div>

{#each ideas as idea}
  <p>IDEA HERE WOW! {JSON.stringify(idea)}</p>
{:else}
  <p>No ideas found</p>
{/each}

{#if $user ? $user.email : false}
  <button on:click={logOut} class="switch">Logout</button>
{/if}

<svelte:window on:keypress={handleKeyPress} />

<!-- <div class="login">
  {#if !signup}
    <button on:click={signInWithX("google")}>Google</button>
    <button on:click={signInWithX("github")}>Github</button>
    <button on:click={signInWithX("twitter")}>Twitter</button>
    <input type="text" bind:value={emailInput} />
    <input type="password" bind:value={passwordInput} />
    <button on:click={signInWithX("email")}>Email</button>
  {/if}
  {#if signup}
    <button on:click={signUpWithX("google")}>Google</button>
    <button on:click={signUpWithX("github")}>Github</button>
    <button on:click={signUpWithX("twitter")}>Twitter</button>
    <input type="text" bind:value={emailInput} />
    <input type="password" bind:value={passwordInput} />
    <button on:click={signUpWithX("email")}>Email</button>
  {/if}
  <button on:click={() => (signup = !signup)}
    >{signup ? "Sign In" : "Sign Up"}</button
  >
</div> -->
<style>
</style>
