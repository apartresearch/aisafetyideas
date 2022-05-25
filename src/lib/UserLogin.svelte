<script>
  import { signInWithGoogle, getUserData, signout } from "$lib/db.js";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  let user = null,
    rawData = {};

  onMount(async () => {
    user = await getUserData();
    console.log(user);
  });
</script>

{#if user}
  <div
    class="user"
    use:tippy={{
      content: `Signed in as ${user.user_metadata.name}. <a href="" on:click={signout}>Sign out</a>.`,
      allowHTML: true,
      interactive: true,
      delay: [250, 0],
      appendTo: document.body,
    }}
  >
    <img src={user.user_metadata.avatar_url} />
    {user.user_metadata.name}
  </div>
{:else}
  <button on:click={signInWithGoogle}>
    <img src="/images/person-outline (2).svg" alt="profile image" /> Sign in
  </button>
{/if}

<style>
  button {
    font-size: 0.9em;
    color: black;
    background: transparent;
    border: 2px solid #000;
    padding: 0.5em 2em;
    border-radius: 0.3em;
    margin-left: -2em;
    display: flex;
  }

  button img {
    width: 1.5em;
    margin-right: 0.5em;
  }

  button:hover {
    cursor: pointer;
    background-color: #44ff98;
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
