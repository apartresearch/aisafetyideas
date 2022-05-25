<script>
  import { signInWithGoogle, getUserData, signout } from "$lib/db.js";
  import { onMount } from "svelte";
  let user = {},
    rawData = {};

  onMount(async () => {
    user = await getUserData();
    console.log(user);
    if (user.raw_user_meta_data) {
      rawData = JSON.parse(user.raw_user_meta_data);
    }
  });
</script>

{#if user}
  {#if user.isSignedIn}
    User signed in. {user.displayName}
  {:else}
    <img src={rawData.avatar_url} />Loading user data
  {/if}
{:else}
  <button on:click={signInWithGoogle}> Sign in </button>
{/if}

<style>
  button {
    background: transparent;
  }
</style>
