<script>
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import SuperprojectTag from "$lib/SuperprojectTag.svelte";
  import Comment from "$lib/Comment.svelte";
  import { onMount } from "svelte";
  import moment from "moment";
  import {
    user,
    ideaCurrent,
    ideaViewVisible,
    ideas,
    shownIdeas,
  } from "$lib/stores.js";
  import { supabase } from "$lib/db.js";
  import { addLikeToIdea } from "$lib/db.js";
  import UserLogin from "$lib/UserLogin.svelte";
  import Interest from "$lib/Interest.svelte";

  const setVisible = (val) => {
    $ideaViewVisible = val;
  };

  const addComment = async () => {
    const comment = {
      idea: $ideaCurrent.id,
      text: commentText,
      author: $user.id,
      reply_to: replyTo,
    };
    if ($ideaCurrent) {
      replyTo > 0
        ? $ideaCurrent.comments
            .find((c) => c.id == replyTo)
            .replies.push(comment)
        : $ideaCurrent.comments.push(comment);
      $ideaCurrent.comments_n++;
      $shownIdeas.forEach((idea) => {
        if (idea.id == $ideaCurrent.id) {
          replyTo > 0
            ? idea.comments.find((c) => c.id == replyTo).replies.push(comment)
            : idea.comments.push(comment);
          idea.comments_n++;
        }
      });
      $ideas.forEach((idea) => {
        if (idea.id == $ideaCurrent.id) {
          replyTo > 0
            ? idea.comments.find((c) => c.id == replyTo).replies.push(comment)
            : idea.comments.push(comment);
          idea.comments_n++;
        }
      });
      $ideaCurrent = $ideaCurrent;
      // $shownIdeas = $shownIdeas;
      // $ideas = $ideas;
      await supabase.from("comments").insert(comment);
      replyTo = null;
      commentText = "";
    }
  };

  let commentText = "",
    commentUsername = "",
    commentUserlink = "",
    replyTo = null;

  const replyToComment = (reply_to_id) => {
    if (reply_to_id == replyTo) {
      replyTo = null;
    } else {
      replyTo = reply_to_id;
    }
  };

  onMount(() => {
    document.body.addEventListener("keydown", (e) => {
      // Register escape key
      if (e.code == "Escape") {
        if (replyTo) {
          replyTo = null;
        } else {
          setVisible(false);
        }
      }
    });
  });

  const removeComment = async (id) => {
    // $ideaCurrent.comments = $ideaCurrent.comments.filter(
    //   (comment) => comment.id != id
    // );
    // $shownIdeas.forEach((idea) => {
    //   if (idea.id == $ideaCurrent.id) {
    //     idea.comments = idea.comments.filter((comment) => comment.id != id);
    //   }
    // });
    $ideas.forEach((idea) => {
      if (idea.id == $ideaCurrent.id) {
        idea.comments = idea.comments.filter((comment) => comment.id != id);
      }
    });
    $ideaCurrent = $ideaCurrent;
    // $shownIdeas = $shownIdeas;
    // $ideas = $ideas;
    await supabase.from("comments").delete().match({ id: id });
  };
</script>

<content
  class="fullscreen-wrapper {$ideaViewVisible ? '' : 'hidden'}"
  on:click|self={() => setVisible(false)}
>
  <div class="current-idea" on:click={() => {}}>
    {#if $ideaCurrent}
      <div class="idea-top">
        <div class="idea-top-left">
          {#if $ideaCurrent.sourced}
            <p class="very-small">
              <a href={$ideaCurrent.sourced} target="_blank">Source</a>
              {#if $ideaCurrent.from_date}
                from {moment($ideaCurrent.from_date).fromNow()}
              {/if}
            </p>
          {/if}
          {#if !$ideaCurrent.sourced && $ideaCurrent.from_date}
            <p class="very-small">
              {$ideaCurrent.from_date}
            </p>
          {/if}
          {#if !$ideaCurrent.sourced && !$ideaCurrent.from_date}
            <p class="very-small">
              From {moment($ideaCurrent.created_at).fromNow()}
            </p>
          {/if}
        </div>
        <div class="top-right">
          {#if $ideaCurrent.difficulty}
            <p
              class="difficulty"
              use:tippy={{
                content: "An estimate of the amount of work required.",
              }}
            >
              {$ideaCurrent.difficulty}h work
            </p>
          {/if}
          <img
            on:click={() => setVisible(false)}
            src="/images/close-outline.svg"
            alt="Close idea"
            class="cross"
          />
        </div>
      </div>
      <p class="current-idea-author">
        {$ideaCurrent.author ? $ideaCurrent.author : $ideaCurrent.username}
      </p>

      <h2 class="current-idea-title">{$ideaCurrent.title}</h2>
      <div class="current-idea-text">
        {@html markdown($ideaCurrent.summary)}
      </div>
      <h4>Show your interest</h4>
      <div class="flex-hori">
        <div class="heart-indicator">
          <img
            class={$user && $ideaCurrent.user_liked ? "heart-icon" : ""}
            on:click={() => {
              if ($user) {
                addLikeToIdea(
                  $ideaCurrent.id,
                  $user && $ideaCurrent.user_liked
                );
                $ideaCurrent = {
                  ...$ideaCurrent,
                  user_liked: !$ideaCurrent.user_liked,
                  likes: $ideaCurrent.user_liked ? 1 : -1,
                };
              }
            }}
            src="/images/heart{$user && $ideaCurrent.user_liked
              ? ''
              : '-outline'}.svg"
            alt="Heart icon"
            use:tippy={{
              content: `${
                $user && $ideaCurrent.user_liked
                  ? "You liked this idea. Click to unlike."
                  : $user
                  ? "Click to like this idea."
                  : "Login to like this idea."
              }`,
              delay: [250, 0],
            }}
          />
          <p>{$ideaCurrent.likes}</p>
        </div>
        <div class="heart-indicator">
          <img
            src="/images/person-outline (2).svg"
            alt="Person icon"
            use:tippy={{
              content: `${
                $user
                  ? "Click below if you might be interested in helping out on this idea."
                  : `Login to show your interest in this idea.`
              }`,
              delay: [250, 0],
            }}
          />
          <p>{$ideaCurrent.interests_n}</p>
        </div>
      </div>
      <Interest />

      {#if $ideaCurrent.contact || $ideaCurrent.verified_by_expert || $ideaCurrent.mentorship_from}
        <h4>Contact and mentorship</h4>
      {/if}
      {#if $ideaCurrent.contact}
        <p class="small">
          Contact the author {$ideaCurrent.author} on
          <a href="mailto:{$ideaCurrent.contact}">{$ideaCurrent.contact}</a>.
        </p>
      {/if}
      {#if $ideaCurrent.mentorship_from && !$ideaCurrent.mentorship_from.includes("@")}
        <p class="small">
          Get mentorship for this project <a
            href="${$ideaCurrent.mentorship_from}">here</a
          >.
        </p>
      {/if}
      {#if $ideaCurrent.verified_by_expert}
        <p
          class="small"
          use:tippy={{
            content:
              "We consult with experts in the respective field that every idea is in to evaluate whether they have good research taste, are positive utility, are well formulated, and so on.",
            delay: [250, 0],
          }}
        >
          This idea has been verified by an expert.
        </p>
      {/if}
      {#if $ideaCurrent.funding_amount > 0 && $ideaCurrent.funding_from}
        <h4>Funding</h4>
        <p>
          Funding (up to {$ideaCurrent.funding_currency}{$ideaCurrent.funding_amount})
          is available from <a href={$ideaCurrent.funding_from}>this page</a>.
        </p>
      {/if}

      {#if $ideaCurrent.categories[0]}
        <h4>Categories</h4>
        <div class="idea-categories-wrapper">
          {#each $ideaCurrent.categories as cat}
            <CategoryTag cat={cat.category} />
          {/each}
        </div>
      {/if}
      {#if $ideaCurrent.superprojects[0]}
        <h4>
          Superproject{$ideaCurrent.superprojects.length > 1 ? "s" : ""}
        </h4>
        <div class="idea-superprojects-wrapper">
          {#each $ideaCurrent.superprojects as superproject}
            <SuperprojectTag superproject={superproject.superproject} />
          {/each}
        </div>
      {/if}
      <h4>Comments</h4>
      <div class="add-comment">
        {#if $user}
          <textarea
            class="comment-text"
            type="text"
            bind:value={commentText}
            placeholder="Add a comment..."
            use:tippy={{
              content: `Supports markdown, e.g. *italic*, **bold**, [links](https://example.com).`,
              allowHTML: true,
              delay: [250, 0],
            }}
          />
          <div class="col2">
            <UserLogin />
            <button
              class="submit"
              use:tippy={{
                content:
                  "You cannot edit or delete your comment after it is posted.",
                delay: [250, 0],
              }}
              on:click={() => {
                addComment();
              }}
            >
              Add comment
            </button>
          </div>
        {/if}
        {#if !$user}
          <p>You need to be logged in to add a comment.</p>
        {/if}
      </div>

      {#if $ideaCurrent.comments.length > 0}
        <div class="idea-comments-wrapper">
          {#each $ideaCurrent.comments as comment}
            <Comment
              {comment}
              currentComment={replyTo}
              {replyToComment}
              {removeComment}
            />
          {/each}
        </div>
      {/if}
    {:else}
      <h3>Select an idea</h3>
    {/if}
  </div>
</content>

<style>
  content {
    z-index: 202;
  }

  /* 
  Build a popup like ProductHunt. There is a parent with 
  scrolling and a relative size unit as child. 
  */

  :global(current-idea-text > p) {
    font-size: 3rem;
  }

  .flex-hori {
    display: flex;
    flex-direction: row;
  }
  .above {
    z-index: 100;
  }

  .heart-icon {
    cursor: pointer;
    margin: 0;
    height: 1.4em;
    /* filter: invert(32%) sepia(44%) saturate(1981%) hue-rotate(189deg)
      brightness(98%) contrast(88%); */
  }

  .heart-indicator {
    display: flex;
  }

  .heart-indicator:hover {
    opacity: 0.75;
  }

  .heart-indicator > img {
    height: 1.5rem;
    margin-right: 0.5rem;
    margin-left: 0.5rem;
    cursor: pointer;
  }

  .heart-indicator > p {
    font-size: 1.2rem;
    font-weight: 500;
    margin: 0;
  }

  .idea-top {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .idea-top-left {
  }

  .cross {
    cursor: pointer;
    width: 1.5em;
  }

  .very-small {
    font-size: 1rem;
    line-height: 1.2rem;
    font-style: italic;
  }

  .idea-comments-wrapper {
    margin-bottom: 2rem;
  }

  .add-comment {
    display: flex;
    flex-direction: row;
    margin-bottom: 1rem;
  }

  .comment-text {
    width: 69%;
    height: 100px;
    border: 1px solid #ccc;
    border-radius: 0.3em;
    padding: 0.5em;
    font-size: 0.8em;
    resize: none;
    margin: 0;
  }

  .col2 {
    width: 30%;
    margin-left: 1%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .submit {
    margin-top: 0.5em;
    width: 100%;
    border: 1px solid #ccc;
    border-radius: 0.3em;
    font-size: 0.8em;
    background-color: #eee;
    cursor: pointer;
  }

  .submit:hover {
    background-color: #ddd;
  }

  .fullscreen-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: #0009;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }

  .current-idea {
    display: flex;
    flex-direction: column;
    justify-content: top;
    align-items: top;
    position: absolute;
    margin: 50px auto;
    max-width: 700px;
    padding: 20px;
    background-color: #fff;
    min-height: 600px;
    min-width: 320px;
    cursor: default;
    border-radius: 5px;
  }

  .current-idea-author {
    margin-bottom: 4px;
    line-height: 1em;
  }

  .current-idea-title {
    margin-top: 0;
    margin-bottom: 0.14em;
  }

  .idea-superprojects-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
    margin-bottom: 10px;
  }

  .hidden {
    display: none;
  }

  .idea-categories-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
  }

  .difficulty {
    font-size: 0.7em;
    line-height: 1em;
    display: inline-block;
    /* Put in the right side */
  }
  /* Mobile responsive */
  @media screen and (max-width: 700px) {
    .add-comment {
      flex-direction: column;
    }

    .col2 {
      width: 100%;
      margin: 0;
    }
    .comment-text {
      width: 100%;
      margin-bottom: 0.3em;
    }
  }
</style>
