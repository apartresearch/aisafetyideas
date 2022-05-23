<script>
  import moment from "moment";
  import markdown from "$lib/drawdown";
  export let comment, currentComment, replyToComment;
</script>

<div
  class="comment {comment.reply_to ? 'reply' : ''} {comment.id == currentComment
    ? 'current'
    : ''}"
>
  <p class="author">
    {#if comment.anon_author_url}
      <a class="author" target="_blank" href={comment.anon_author_url}>
        <img src="/images/link.svg" alt="Link icon" />
        {comment.anon_author ? comment.anon_author : "Anonymous"}
      </a>
    {:else}
      {comment.anon_author ? comment.anon_author : "Anonymous"}
    {/if}
    <span class="date">{moment(comment.created_at).fromNow()}</span>
  </p>
  {@html markdown(comment.text)}
  {#if replyToComment}
    <div class="reply-to">
      <!-- svelte-ignore a11y-invalid-attribute -->
      <a
        href=""
        on:click={() =>
          replyToComment(!comment.reply_to ? comment.id : comment.reply_to)}
      >
        {comment.id == currentComment
          ? `Replying to ${comment.anon_author} - write your comment above`
          : "Reply"}
      </a>
    </div>
  {/if}
</div>

{#if comment.replies.length > 0}
  <div class="replies">
    {#each comment.replies as reply}
      <div class="comment reply">
        <p class="author">
          {#if reply.anon_author_url}
            <a class="author" target="_blank" href={reply.anon_author_url}>
              <img src="/images/link.svg" alt="Link icon" />
              {reply.anon_author ? reply.anon_author : "Anonymous"}
            </a>
          {:else}
            {reply.anon_author ? reply.anon_author : "Anonymous"}
          {/if}
          <span class="date">{moment(reply.created_at).fromNow()}</span>
        </p>
        {@html markdown(reply.text)}
        <div class="reply-to">
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a
            href=""
            on:click={() =>
              replyToComment(!comment.reply_to ? comment.id : comment.reply_to)}
          >
            Reply
          </a>
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- {#each comment.replies as reply}
{/each} -->
<style>
  .current {
    /* Make green background */
    background-color: #eee;
  }

  .comment {
    border-left: 1px solid #ccc;
    padding: 0.3em 0.5em;
  }

  .reply-to {
    font-size: 0.8em;
    margin-top: 0em;
  }

  :global(.comment > h1, .comment > h2, .comment > h3, .comment > h4, .comment
      > h5, .comment > h6, .comment > p, .comment > a) {
    margin: 0;
    font-size: 0.7em;
    line-height: 1.3em;
  }

  .date {
    font-size: 0.7rem;
    margin-left: 0.4em;
  }

  a {
    color: #666;
    font-size: 0.8em;
    font-style: normal;
    margin-bottom: 0px;
  }

  .reply {
    padding-left: 2em;
  }

  .author {
    color: #666;
    font-size: 0.7em;
    font-style: normal;
    margin-bottom: 0px;
  }

  .author > img {
    height: 1em;
    opacity: 0.5;
    transform: rotate(45deg);
    margin-bottom: 0.2em;
  }
</style>
