<script>
  import { supabase } from "$lib/db";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import Nav from "$lib/Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import DataLoader from "$lib/DataLoader.svelte";
  import Footer from "$lib/Footer.svelte";
  import Comment from "$lib/Comment.svelte";
  import Select from "svelte-select";
  import tippy from "sveltejs-tippy";
  import { signout } from "$lib/db.js";
  import {
    ideas,
    superprojects,
    comments,
    loading,
    users,
    user,
  } from "$lib/stores";
  import { exclude_internal_props } from "svelte/internal";
  const user_slug = $page.params.user;

  //   Load user information
  let username = "",
    bio = "",
    career = "",
    doesnotexist = false,
    saved = false;

  onMount(async () => {
    initLoop();
  });

  const initLoop = () => {
    if ($loading) {
      window.setTimeout(initLoop, 100);
    } else {
      if (user_slug) {
        const userTemp = $users.find((u) => u.username === user_slug);
        console.log(username, userTemp, doesnotexist);
        if (userTemp) {
          username = userTemp.username;
          bio = userTemp.bio;
          career = userTemp.career_stage;
        } else {
          doesnotexist = true;
        }
        console.log(username, userTemp, doesnotexist);
      }
    }
  };

  const careerStages = [
    {
      value: "Early",
      label: "Early",
    },
    {
      value: "Mid",
      label: "Mid career",
    },
    {
      value: "Late",
      label: "Late career",
    },
    {
      value: "Student",
      label: "Student",
    },
  ];

  const handleSelect = (e) => {
    career = e.detail.value;
  };

  const save = async () => {
    const user_data = {
      username: username,
      bio: bio,
      career_stage: career,
    };
    await supabase.from("users").update(user_data).match({ id: $user.id });
    saved = true;
  };

  const handleUsername = (e) => {
    username = e.detail.value;
  };
</script>

<DataLoader />
<Nav />

<div class="container">
  {#if $loading}
    <LoadIcon />
  {:else if doesnotexist}
    This user does not exist.
  {:else}
    <p class={"career " + career}>{career} career</p>
    <h2>{username}</h2>

    {#if bio}
      <div class="user-bio">
        {@html markdown(bio)}
      </div>
    {/if}

    {#if $user.username == user_slug}
      <button class="signout" on:click={() => signout()}> Sign out </button>
      <h3><i>Edit your information</i></h3>
      <div class="input">
        <div class="select">
          <input
            type="text"
            on:ended={handleUsername}
            value={username}
            disabled
            use:tippy={{
              content: "Username cannot be changed at the moment.",
            }}
          />
          <Select
            on:select={handleSelect}
            value={career}
            items={careerStages}
          />
        </div>
        <textarea bind:value={bio} />
      </div>
      <button on:click={() => save()}>Save changes</button>
    {/if}
    <div class="user-ideas">
      <h2>Ideas</h2>
      {#each $ideas as idea}
        {#if idea.author == username}
          <Idea {idea} />
        {/if}
      {/each}
    </div>
    <div class="user-comments">
      <h2>Comments</h2>
      {#each $comments as comment}
        {#if comment.username == username}
          <a href={`/?idea=` + comment.idea} class="comment-indicator">
            Go to idea
          </a>
          <Comment {comment} />
        {/if}
      {/each}
    </div>
  {/if}
</div>

<IdeaViewer />
<Footer />

<style>
  h2,
  h3,
  .career {
    margin: 0;
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid #ccc;
    border-radius: var(--border-radius);
    padding: 0.2rem 0.4rem;
    margin-top: 8px;
    font-size: 0.8rem;
    line-height: 1.1rem;
  }

  button {
    margin-top: 8px;
    padding: 0.5rem 2rem;
    font-size: 0.8rem;
    line-height: 1.1rem;
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius);
    background-color: var(--primary-color);
    color: var(--primary-color-hover);
  }

  button:hover {
    background-color: var(--primary-color-hover);
    color: var(--primary-color);
  }

  .input {
    display: flex;
    flex-direction: row;
    column-gap: 0.2rem;
  }

  .select {
    min-width: 30%;
    row-gap: 0.2rem;
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    line-height: 1.1rem;
  }

  .career {
    font-size: 0.75rem;
    font-weight: bold;
  }

  .Early {
    color: var(--early);
  }

  .Mid {
    color: var(--mid);
  }

  .Late {
    color: var(--late);
  }

  .Student {
    color: var(--student);
  }

  .comment-indicator {
    display: block;
    font-size: 0.8rem;
    float: right;
  }
  .container {
    max-width: 820px;
    padding: 5px 10px;
    margin: -3rem auto 0 auto;
    position: relative;
    z-index: 102;
    background: var(--bg-color-light);
    border-radius: var(--border-radius);
    min-height: 500px;
  }

  .user-ideas {
    margin-top: 20px;
  }

  .user-comments {
    margin-top: 20px;
  }
</style>
