<script>
  import moment from "moment";
  import markdown from "$lib/drawdown";
  export let comment, currentComment, replyToComment, removeComment;
  import { ideas, user } from "$lib/stores.js";
</script>

<div
  class="comment {comment.reply_to ? 'reply' : ''} {comment.id == currentComment
    ? 'current'
    : ''}"
>
  <a class="author" target="_blank" href={"/user/" + comment.username}>
    <!-- <img src="/images/link.svg" alt="Link icon" /> -->
    {@html comment.anon_author ? comment.anon_author : comment.username}
  </a>
  <span class="date">{moment(comment.created_at).fromNow()}</span>
  {@html markdown(comment.text)}
  {#if $user && (replyToComment || $user.id == comment.author)}
    <div class="reply-to">
      <!-- svelte-ignore a11y-invalid-attribute -->
      <a
        href=""
        on:click={() =>
          replyToComment(!comment.reply_to ? comment.id : comment.reply_to)}
      >
        {comment.id == currentComment
          ? `Replying to this comment - write your comment above`
          : "Reply"}
      </a>
      {#if $user.id == comment.author}
        <!-- svelte-ignore a11y-invalid-attribute -->
        <a
          href=""
          on:click={() => {
            removeComment(comment.id);
            comment.replies.splice(comment, 1);
            comment = comment;
          }}
          class="delete-comment"
        >
          | Delete your comment
        </a>
      {/if}
    </div>
  {/if}
</div>

{#if comment.replies.length > 0}
  <div class="replies">
    {#each comment.replies as reply, i}
      <div class="comment reply">
        <a class="author" target="_blank" href={"/user/" + reply.username}>
          <!-- <img src="/images/link.svg" alt="Link icon" /> -->
          {@html reply.username}
          <span class="date">{moment(reply.created_at).fromNow()}</span>
        </a>
        {@html markdown(reply.text)}
        {#if $user && (replyToComment || $user.id == reply.author)}
          <div class="reply-to">
            <!-- svelte-ignore a11y-invalid-attribute -->
            <a
              href=""
              on:click={() =>
                replyToComment(
                  !comment.reply_to ? comment.id : comment.reply_to
                )}
            >
              Reply
            </a>
            {#if $user.id == reply.author}
              <!-- svelte-ignore a11y-invalid-attribute -->
              <a
                href=""
                on:click={() => {
                  removeComment(reply.id);
                  comment.replies.splice(i, 1);
                  comment = comment;
                }}
                class="delete-comment"
              >
                Delete your comment
              </a>
            {/if}
          </div>
        {/if}
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
