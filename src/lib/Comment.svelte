<script>
  import markdown from "$lib/drawdown";
  export let comment;
</script>

<div class={comment.reply_to ? "reply" : ""}>
  {#if comment.anon_author || comment.author}
    {#if comment.anon_author_url}
      <a class="author" href={comment.anon_author_url}>{comment.anon_author}</a>
    {:else}
      <p class="author">{comment.anon_author}</p>
    {/if}
  {/if}
  {@html markdown(comment.text)}
</div>

<style>
  .reply {
    margin-left: 1em;
  }

  .author {
    font-style: italic;
  }
</style>
