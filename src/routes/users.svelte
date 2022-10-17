<script>
  import UserBlock from "$lib/UserBlock.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Nav from "$lib/Nav.svelte";
  import Footer from "$lib/Footer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import { user, users, loading } from "$lib/stores.js";
</script>

<DataLoader />

<Nav />
{#if $loading}
  <LoadIcon />
{:else}
  <div class="container">
    <h2>Users</h2>
    <div class="users">
      {#each $users.sort((a, b) => a.username.localeCompare(b.username)) as u}
        <UserBlock user={u} />
      {:else}
        <h2>No users found</h2>
      {/each}
    </div>
  </div>
{/if}

<Footer />

<style>
  h2 {
    margin-top: 0.4rem;
  }

  .container {
    max-width: 820px;
    margin: 0 auto;
    padding: 10px 10px;
    position: relative;
    min-height: 500px;
  }

  .users {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    column-gap: 0.5rem;
  }

  @media (max-width: 768px) {
    .container {
      margin-top: 0;
    }
  }
</style>
