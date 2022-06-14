<script>
  import markdown from "$lib/drawdown";
  import tippy from "sveltejs-tippy";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import SuperprojectTag from "$lib/SuperprojectTag.svelte";
  import Comment from "./Comment.svelte";
  import moment from "moment";
  import { user, ideaViewVisible, ideaCurrent } from "$lib/stores.js";
  import { addLikeToIdea } from "$lib/db.js";
  import { Toasts, addToast } from "as-toast";
  import MediaQuery from "$lib/MediaQuery.svelte";

  export let idea,
    selectCategory = undefined,
    url;

  const selectIdea = () => {
    $ideaViewVisible = true;
    $ideaCurrent = idea;
    if (!url) {
      url = new URL(window.location.href);
    }
    url.searchParams.set("idea", idea.id);
    window.history.pushState(null, document, url.href);
  };
</script>

<div class="idea-card" on:click={() => selectIdea()}>
  <div class="idea-top">
    <div class="idea-superprojects-wrapper list-item" on:click|stopPropagation>
      {#if idea.author}
        <div class="idea-author">
          {idea.author}
        </div>
      {:else}
        <a class="idea-author" href={"/user/" + idea.username}>
          {idea.username}
        </a>
      {/if}
      {#if idea.verifications_n > 0}
        <div class="idea-author">
          ⭐
          <span class="idea-verifications-n">
            {idea.verifications_n}
          </span>
        </div>
      {/if}
      {#if idea.superprojects[0]}
        {#each idea.superprojects as superproject}
          <SuperprojectTag
            superproject={superproject.superproject}
            small={true}
          />
        {/each}
      {/if}
    </div>
    <div class="idea-icons" on:click|stopPropagation>
      {#if idea.contact}
        <a
          target="_blank"
          href="mailto:{idea.contact}"
          use:tippy={{
            content: `Email the author: <a target="_blank" href="mailto:${idea.contact}">${idea.contact}</a>`,
            allowHTML: true,
            interactive: true,
            delay: [250, 0],
            appendTo: document.body,
          }}
        >
          <img src="/images/at.svg" alt="Send email to author icon" />
        </a>
      {/if}
      {#if idea.sourced}
        <a
          href={idea.sourced}
          target="_blank"
          use:tippy={{
            content: `View the source of this idea`,
            allowHTML: true,
            delay: [250, 0],
          }}
        >
          <img src="/images/link.svg" alt="Source link icon" />
        </a>
      {/if}
      {#if idea.verifications_n > 0}
        <div
          use:tippy={{
            content: `This idea has been verified by ${idea.verifications_n} <a href='/users'>experts</a>.`,
            allowHTML: true,
            interactive: true,
            delay: [250, 0],
          }}
        >
          <img src="/images/checkmark.svg" alt="Expert verified icon" />
        </div>
      {/if}
      {#if idea.mentorship_from}
        <div
          use:tippy={{
            content: `Mentorship for this idea is available from <a target="_blank" href="${
              idea.mentorship_from.includes("@")
                ? "mailto:" + idea.mentorship_from
                : idea.mentorship_from
            }">${
              idea.mentorship_from.includes("@") ? idea.mentorship_from : "here"
            }</a>.`,
            allowHTML: true,
            interactive: true,
            delay: [250, 0],
          }}
        >
          <img src="/images/help-outline (1).svg" alt="Expert verified icon" />
        </div>
      {/if}
      {#if idea.comments_n > 0}
        <div
          class="comment-indicator"
          use:tippy={{
            content: `This idea has ${idea.comments_n} comments.`,
            allowHTML: true,
            delay: [250, 0],
          }}
        >
          <img src="/images/chatbubbles-outline (3).svg" alt="Comments icon" />
          <p>{idea.comments_n}</p>
        </div>
      {/if}
      <MediaQuery query="(max-width: 768px)" let:matches>
        {#if matches}
          <div class="comment-indicator">
            <img
              class="heart"
              on:click={() => {
                if ($user) {
                  addLikeToIdea(idea.id, $user && idea.user_liked);
                  idea.user_liked = !idea.user_liked;
                  idea.likes += idea.user_liked ? 1 : -1;
                  idea = idea;
                }
              }}
              src="/images/heart{$user && idea.user_liked
                ? ''
                : '-outline'}.svg"
              alt="Heart icon"
              use:tippy={{
                content: `${
                  $user && idea.user_liked
                    ? "You liked this idea. Click to unlike."
                    : $user
                    ? "Click to like this idea."
                    : "Login to like this idea."
                }`,
                delay: [250, 0],
              }}
            />
            <p>{idea.likes}</p>
          </div>
          <div class="comment-indicator">
            <img
              use:tippy={{
                content: `Login to show your interest in this idea.`,
              }}
              class="heart"
              src="/images/person-outline (2).svg"
              alt="Human icon"
            />
            <p>{idea.interests_n}</p>
          </div>
          {#if idea.verifications_n > 0}
            <div class="comment-indicator">
              ⭐
              <p class="idea-verifications-n">
                {idea.verifications_n}
              </p>
            </div>
          {/if}
        {/if}
      </MediaQuery>
    </div>
  </div>
  <h3 class="idea-title">{idea.title}</h3>
  <div class="idea-bottom">
    {#if idea.categories[0]}
      <div class="idea-categories-wrapper list-item" on:click|stopPropagation>
        {#each idea.categories as cat, i}
          <CategoryTag cat={cat.category} small={true} {selectCategory} />
          {#if i < idea.categories.length - 1}
            <div class="idea-category-separator">·</div>
          {/if}
        {/each}
      </div>
    {/if}
    <div class="bottom-right" on:click|stopPropagation>
      {#if idea.difficulty}
        <p
          class="difficulty"
          use:tippy={{
            content: "An estimate of the amount of work required.",
          }}
        >
          {idea.difficulty}h work
        </p>
      {/if}
      {#if idea.funding_amount > 0}
        <p
          class="funding"
          use:tippy={{
            content: `Apply for this funding <a href="${idea.funding_from}">here</a>.`,
            allowHTML: true,
            interactive: true,
          }}
        >
          {idea.funding_currency}{idea.funding_amount}
        </p>
      {/if}
      <p class="date">
        {idea.from_date
          ? `${moment(idea.from_date).fromNow()}`
          : `${moment(idea.created_at).fromNow()}`}
      </p>
      <div class="comment-indicator heart">
        <img
          class="heart"
          on:click={() => {
            if ($user) {
              addLikeToIdea(idea.id, $user && idea.user_liked);
              idea.user_liked = !idea.user_liked;
              idea.likes += idea.user_liked ? 1 : -1;
              idea = idea;
            }
          }}
          src="/images/heart{$user && idea.user_liked ? '' : '-outline'}.svg"
          alt="Heart icon"
          use:tippy={{
            content: `${
              $user && idea.user_liked
                ? "You liked this idea. Click to unlike."
                : $user
                ? "Click to like this idea."
                : "Login to like this idea."
            }`,
            delay: [250, 0],
          }}
        />
        <p>{idea.likes}</p>
      </div>
      <div class="comment-indicator heart">
        <img
          use:tippy={{
            content: `Login to show your interest in this idea.`,
          }}
          class="heart"
          src="/images/person-outline (2).svg"
          alt="Human icon"
        />
        <p>{idea.interests_n}</p>
      </div>
    </div>
  </div>
</div>

<Toasts />

<style>
  .heart-icon {
    cursor: pointer;
    margin: 0;
    height: 1.4em;
    /* filter: invert(18%) sepia(95%) saturate(2588%) hue-rotate(233deg)
      brightness(83%) contrast(90%); */
  }

  .heart:hover {
    opacity: 0.8;
  }

  .bottom-right {
    display: flex;
    flex-direction: row;
    column-gap: 0.3em;
    margin-left: auto;
  }

  .date {
    color: #999;
  }

  .idea-bottom {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .difficulty,
  .date {
    font-size: 0.7em;
    line-height: 1em;
    margin: 0;
  }

  .comment-indicator.heart {
    font-size: 0.7em;
    line-height: 0.8em;
    margin-top: -0.15em;
  }

  .comment-indicator.heart > * {
    margin: 0;
    height: 1.4em;
  }

  .comment-indicator {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .comment-indicator p {
    text-align: center;
    margin-left: 0.2em;
    padding-top: 0.3em;
  }

  .idea-superprojects-wrapper.list-item {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
  }

  .idea-categories-wrapper.list-item {
    font-style: italic;
    margin-left: -0.1em;
    float: left;
    white-space: nowrap;
    flex-wrap: wrap;
  }

  .idea-category-separator {
    margin: 0 0.1em 0.1em 0;
    line-height: 0.8em;
  }

  .idea-card {
    background-color: var(--light-accent-bg);
    padding: 7px 10px;
    margin: 0;
    width: 100%;
  }

  .idea-card:hover {
    background-color: var(--light-accent-border);
    cursor: pointer;
  }

  .idea-top {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: -0.2em;
  }

  .idea-icons {
    display: flex;
    align-items: right;
    font-size: 0.7em;
    line-height: 0.8em;
  }

  .idea-icons * {
    margin: 0;
    margin-left: 0.1em;
    cursor: pointer;
    text-decoration: none;
  }

  .idea-icons > * > * {
    margin: 0;
    height: 1.4em;
  }

  .idea-icons *:hover {
    opacity: 0.75;
  }

  .idea-author {
    font-size: 0.7em;
    line-height: 0.8em;
    border: 0;
    padding: 0;
    vertical-align: bottom;
    margin-right: 0.6em;
    margin-top: 0.1em;
    white-space: nowrap;
  }

  .idea-title {
    font-size: 0.8em;
    line-height: 1.2em;
    margin: 0.2rem 0 0.1rem 0;
    max-width: 90%;
  }

  .idea-card {
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
    margin: 0.175rem 0;
    border: 1px solid var(--light-accent-border);
    transition: all 0.1s ease-in-out;
  }

  .idea-card:hover {
    box-shadow: var(--box-shadow-hover);
    transform: translate(0, -0.1rem);
    border: 1px solid var(--primary-color);
    background-color: var(--primary-color-hover);
  }

  /* mobile */
  @media (max-width: 768px) {
    .idea-title {
      margin-top: 0.25em;
      font-size: 0.9rem;
      line-height: 1.1rem;
      max-width: 100%;
      font-weight: 400;
      margin-bottom: 0.25em;
    }

    .idea-categories-wrapper.list-item {
      display: none;
    }

    .idea-superprojects-wrapper.list-item {
      display: none;
    }

    .idea-bottom {
      display: none;
    }

    .idea-card {
      display: flex;
      flex-direction: column-reverse;
    }

    .idea-top {
      margin-bottom: 0.1em;
    }
  }
</style>
