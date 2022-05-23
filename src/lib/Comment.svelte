<script>
  import moment from "moment";
  import markdown from "$lib/drawdown";
  export let comment;
</script>

<div class="comment {comment.reply_to ? 'reply' : ''}">
  {#if comment.anon_author || comment.author}
    {#if comment.anon_author_url}
      <a class="author" target="_blank" href={comment.anon_author_url}>
        <img src="/images/link.svg" alt="Link icon" />
        {comment.anon_author}
        <span class="date">{moment(comment.created_at).fromNow()}</span>
      </a>
    {:else}
      <p class="author">
        {comment.anon_author}
        <span class="date">{moment(comment.created_at).fromNow()}</span>
      </p>
    {/if}
  {/if}
  {@html markdown(comment.text)}
</div>

<style>
  div {
    border-left: 1px solid #ccc;
    padding: 0.3em 0.5em;
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

  .author > img {
    height: 1em;
    opacity: 0.5;
    transform: rotate(45deg);
    margin-bottom: 0.2em;
  }
</style>
