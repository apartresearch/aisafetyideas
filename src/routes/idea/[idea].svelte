<script>
  import { getIdea } from "$lib/db";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import markdown from "$lib/drawdown";
  import tippy from "sveltejs-tippy";
  import LoadIcon from "$lib/LoadIcon.svelte";
  const ideaSlug = $page.params.idea;

  let idea = {},
    url,
    description = false,
    minimal = false,
    loaded = false;

  onMount(async () => {
    loaded = false;
    window.addEventListener("popstate", () => {
      updateFromUrl();
    });
    idea = await getIdea(ideaSlug);
    loaded = true;
  });

  const updateFromUrl = () => {
    url = new URL(window.location.href);
    description = url.searchParams.get("descriptions");
    minimal = url.searchParams.get("minimal");
  };
</script>

<div class="idea">
  {#if loaded}
    <div class="idea-top">
      <div
        class="idea-superprojects-wrapper list-item"
        on:click|stopPropagation
      >
        <div class="idea-author">
          {idea.author}
        </div>
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
        {#if idea.verified_by_expert}
          <div
            use:tippy={{
              content: `This idea has been verified by ${
                !idea.verifier ? "an expert" : idea.verifier
              }`,
              allowHTML: true,
              delay: [250, 0],
            }}
          >
            <img src="/images/checkmark.svg" alt="Expert verified icon" />
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
            <img
              src="/images/chatbubbles-outline (3).svg"
              alt="Comments icon"
            />
            <p>{idea.comments_n}</p>
          </div>
        {/if}
      </div>
    </div>
    <h1 class="idea-title">{idea.title}</h1>
    <div class="description">
      {@html markdown(idea.summary)}
      <div class="see-more">
        <a href="https://aisafetyideas.com/?idea={ideaSlug}">
          See the comments and more
        </a>
      </div>
    </div>
  {:else}
    <LoadIcon small={true} />
  {/if}
</div>

<style>
  .see-more {
    margin-top: -0.5rem;
  }
  .description {
    font-size: 0.7em;
    line-height: 1.5em;
  }
  * {
    display: block;
    float: left;
    margin: 0;
  }

  p {
    margin: 0;
  }

  h1 {
    font-size: 1.5em;
    font-weight: bold;
    margin-bottom: 0.1em;
  }

  .idea {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
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
    line-height: 1em;
    margin: 5px 0 5px 0;
  }

  :global(a) {
    /* Make green */
    color: #27c449;
  }
</style>
