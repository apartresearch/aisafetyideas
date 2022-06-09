<script>
  import { supabase, signout, setUserData } from "$lib/db.js";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  import { user } from "$lib/stores.js";
  export let white = false;

  let loading = false;
  let userData = supabase.auth.user();

  if (userData) setUserData(userData, userData.id);
  supabase.auth.onAuthStateChange((_, session) => {
    console.log("auth state changed", session);
    if (session) setUserData(session.user, session.user.id);
    else $user = null;
  });

  const handleLogin = async () => {
    try {
      loading = true;
      const { error } = await supabase.auth.signIn({ provider: "google" });
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      loading = false;
    }
  };
</script>

{#if $user}
  <div
    class="user  {white ? '' : 'light-bg'}"
    on:click={() => {
      signout();
    }}
    use:tippy={{
      content: `Signed in as ${$user.username}. <a on:click={${signout}}>Sign out</a>.`,
      allowHTML: true,
      interactive: true,
      delay: [250, 0],
      appendTo: document.body,
    }}
  >
    <!-- svelte-ignore a11y-img-redundant-alt -->
    {#if $user.image}
      <img src={$user.image} alt="Avatar" />
    {:else}
      <img src="/images/person-outline (2).svg" alt="Avatar" />
    {/if}
    {$user.username}
  </div>
{:else}
  <button on:click={handleLogin} class={white ? "" : "light-bg"}>
    <!-- svelte-ignore a11y-img-redundant-alt -->
    <img
      src="/images/person-outline (2).svg"
      alt="user icon"
      class={white ? "white" : ""}
    /> Sign in
  </button>
{/if}

<style>
  button {
    font-size: 0.9em;
    background: transparent;
    border: 2px solid transparent;
    padding: 0.5em 2em;
    border-radius: 0.3em;
    display: flex;
    color: inherit;
    border-color: var(--button-bg-color-dark);
  }

  button img {
    width: 1.5em;
    margin-right: 0.5em;
  }

  .white {
    filter: invert(1);
  }

  .light-bg:hover img {
    filter: invert(1);
  }

  .light-bg {
    color: var(--font-color-light);
  }

  .light-bg:hover {
    color: var(--font-color-dark);
  }

  button:hover {
    cursor: pointer;
    background-color: var(--button-bg-color-dark);
  }

  div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }

  div img {
    width: 1.5em;
    margin-right: 0.5em;
    border-radius: 100em;
  }

  .user {
    cursor: pointer;
  }
</style>
