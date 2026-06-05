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
    if (session) setUserData(session.user, session.user.id);
    else $user = null;
  });

  const handleLogin = async () => {
    try {
      loading = true;
      console.log(
        "Logging in. Will return to " + window.location.pathname,
        window.location.href
      );
      const { error } = await supabase.auth.signIn(
        {
          provider: "google",
        },
        {
          redirectTo: window.location.href,
        }
      );
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      loading = false;
    }
  };
</script>

{#if !!$user}
  <a
    style="color: {white ? 'white' : 'black'}"
    href={"/user/" + $user.username}
    class="user"
    use:tippy={{
      content: `Signed in as ${$user.username}. Click to edit information and sign out.`,
      allowHTML: true,
      interactive: true,
      delay: [250, 0],
      appendTo: document.body,
    }}
  >
    {#if $user.image}
      <img src={$user.image} alt="Avatar" />
    {:else}
      <img
        src="/images/person-outline (2).svg"
        alt="Avatar"
        style="filter: invert({white ? 1 : 0});"
      />
    {/if}
    {$user.username}
  </a>
{:else}
  <button on:click={handleLogin} class="button {white ? '' : 'light-bg'}">
    <img
      src="/images/person-outline (2).svg"
      alt="user icon"
      style="filter: invert({white ? 1 : 0});"
    /> Sign in
  </button>
{/if}

<style>
  img {
    width: 1.5rem;
    margin: -0.3rem 0.1rem -0.2rem -0.1rem;
  }

  .light-bg {
    color: var(--font-color-light);
  }

  a {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    font-size: 1rem;
    line-height: 1.1rem;
  }

  a:hover {
    cursor: pointer;
    opacity: 0.8;
    text-decoration: none;
  }

  a img {
    width: 1.5em;
    margin-right: 0.5em;
    border-radius: 100em;
  }

  .user {
    margin-right: 1rem;
  }

  @media only screen and (max-width: 764px) {
    .user {
      margin-right: 0;
    }
  }
</style>
