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
  import { addLikeToIdea, certifyIdea } from "$lib/db.js";
  import UserLogin from "$lib/UserLogin.svelte";
  import Interest from "$lib/Interest.svelte";
  import BurgerButton from "./BurgerButton.svelte";
  export let url;

  const setVisible = (val) => {
    $ideaViewVisible = val;
    if (val == false && url) {
      url.searchParams.delete("idea");
      window.history.pushState(null, document, url.href);
    }
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
      $shownIdeas = $shownIdeas;
      $ideas = $ideas;
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

{#if $ideaViewVisible}
  <content class="fullscreen-wrapper" on:click|self={() => setVisible(false)}>
    <div class="current-idea" on:click={() => {}}>
      {#if $ideaCurrent}
        <div class="idea-top">
          <div class="idea-top-left">
            {#if $ideaCurrent.from_date}
              <p class="very-small">
                {$ideaCurrent.from_date}
              </p>
            {/if}
            {#if !$ideaCurrent.from_date}
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
        {#if $ideaCurrent.author}
          <p class="current-idea-author">
            {$ideaCurrent.author}
          </p>
        {:else}
          <a
            class="current-idea-author"
            href={"/user/" + $ideaCurrent.username}
          >
            {$ideaCurrent.username}
          </a>
        {/if}

        <h2 class="current-idea-title">
          {$ideaCurrent.title}
          {#if $ideaCurrent.sourced}
            (<a href={$ideaCurrent.sourced} target="_blank">source</a>)
          {/if}
        </h2>
        <div class="current-idea-text">
          {@html markdown($ideaCurrent.summary)}
        </div>
        <!-- {#if $ideaCurrent.verifications_n > 0}
          <p
            class="small"
            use:tippy={{
              content:
                "We consult with experts in the respective field that every idea is in to evaluate whether they have good research taste, are positive utility, are well formulated, and so on.",
              delay: [250, 0],
            }}
          >
            This idea has been verified by {$ideaCurrent.verifications_n}
            <a
              href="/users"
              on:click={() => {
                $ideaViewVisible = false;
              }}
              target="_blank">expert(s)</a
            >.
          </p>
        {/if} -->
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
                    likes: ($ideaCurrent.likes += $ideaCurrent.user_liked
                      ? -1
                      : 1),
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
          <div class="heart-indicator">
            <img src="/images/trello.webp" alt="Trello logo" />
            <a
              href="https://trello.com/b/TFNJmgfC/apart-research"
              target="_blank"
            >
              Collab on Trello
            </a>
          </div>
        </div>
        {#if !$user}
          <p class="no-user">
            <i>
              You need to be logged in to express interest and add comments.
            </i>
          </p>
        {/if}

        <Interest />

        <!-- {#if $ideaCurrent.contact || $ideaCurrent.verifications_n > 0 || $ideaCurrent.mentorship_from}
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
              href={$ideaCurrent.mentorship_from}>here</a
            >.
          </p>
        {/if}
        {#if $ideaCurrent.funding_amount > 0 && $ideaCurrent.funding_from}
          <h4>Funding</h4>
          <p>
            Funding (up to {$ideaCurrent.funding_currency}{$ideaCurrent.funding_amount})
            is available from <a href={$ideaCurrent.funding_from}>this page</a>.
          </p>
        {/if} -->
        {#if $user.expert && $ideaCurrent.verifications.find((verification) => verification.user === $user.id)}
          <button
            class="verify"
            on:click={() => certifyIdea($ideaCurrent.id, true)}
          >
            Undo verifying this idea
          </button>
        {:else if $user.expert}
          <button class="verify" on:click={() => certifyIdea($ideaCurrent.id)}>
            Verify idea
          </button>
        {/if}

        <div class="idea-categories-wrapper">
          {#each $ideaCurrent.categories as cat}
            <CategoryTag cat={cat.category} />
          {/each}
        </div>
        <div class="idea-superprojects-wrapper">
          {#each $ideaCurrent.superprojects as superproject}
            <SuperprojectTag superproject={superproject.superproject} />
          {/each}
        </div>
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
        </div>

        {#if $ideaCurrent.comments}
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
        {/if}
      {:else}
        <h3>Select an idea</h3>
      {/if}
    </div>
  </content>
{/if}

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

  .verify {
    background-color: #f5f5f5;
    border: 1px solid #333;
    border-radius: 4px;
    color: #333;
    cursor: pointer;
    font-size: 1.2rem;
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    text-align: center;
    text-decoration: none;
    transition: all 0.2s ease-in-out;
  }

  .verify:hover {
    background-color: #333;
    color: #f5f5f5;
  }

  .no-user {
    color: #0006;
    margin-top: 0.3rem;
    font-size: 1rem;
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
    width: 100%;
    max-width: 700px;
    padding: 20px;
    background-color: #fff;
    min-height: 600px;
    min-width: 320px;
    cursor: default;
    border-radius: var(--border-radius);
  }

  .current-idea-author {
    margin-bottom: 4px;
    line-height: 1em;
  }

  .current-idea-title {
    margin-top: 0;
    margin-bottom: 0.5rem;
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
  @media screen and (max-width: 768px) {
    .add-comment {
      flex-direction: column;
    }

    .top-right {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    }

    .idea-top {
      flex-direction: column-reverse;
    }
    .current-idea {
      width: 100%;
      margin: 0;
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
