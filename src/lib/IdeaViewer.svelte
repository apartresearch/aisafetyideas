<script>
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import supabase from "$lib/db";
  import SuperprojectTag from "$lib/SuperprojectTag.svelte";
  import Comment from "$lib/Comment.svelte";
  export let idea, visible, setVisible, addComment;

  let commentText = "",
    commentUsername = "",
    commentUserlink = "",
    replyTo = null;

  const writeComment = () => {
    const comment = {
      idea: idea.id,
      text: commentText,
      anon_author: commentUsername,
      anon_author_url: commentUserlink,
      reply_to: replyTo,
    };
    addComment(comment);
  };

  const replyToComment = (reply_to) => {
    replyTo = reply_to.id;
  };
</script>

<content
  class="fullscreen-wrapper {visible ? '' : 'hidden'}"
  on:click|self={setVisible(false)}
>
  <div class="current-idea" on:click={() => {}}>
    {#if idea.title}
      <p class="current-idea-author">{idea.author}</p>
      <h2 class="current-idea-title">{idea.title}</h2>
      <div class="current-idea-text">
        {@html markdown(idea.summary)}
      </div>
      {#if idea.categories[0]}
        <h4>Categories</h4>
        <div class="idea-categories-wrapper">
          {#each idea.categories as cat}
            <CategoryTag cat={cat.category} />
          {/each}
        </div>
      {/if}
      {#if idea.superprojects[0]}
        <h4>
          Superproject{idea.superprojects.length > 1 ? "s" : ""}
        </h4>
        <div class="idea-superprojects-wrapper">
          {#each idea.superprojects as superproject}
            <SuperprojectTag superproject={superproject.superproject} />
          {/each}
        </div>
      {/if}
      <h4>Comments</h4>
      <div class="add-comment">
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
          <input
            class="comment-user"
            type="text"
            bind:value={commentUsername}
            placeholder="Your username"
            use:tippy={{
              content: `Your username will be displayed with your comment`,
              allowHTML: true,
              delay: [250, 0],
            }}
          />
          <input
            class="comment-userlink"
            type="text"
            bind:value={commentUserlink}
            placeholder="Your user link"
            use:tippy={{
              content: `Your user link will be linked from your username`,
              allowHTML: true,
              delay: [250, 0],
            }}
          />
          <!-- <input type="number" bind:value={replyTo} placeholder="Reply to" /> -->
          <button
            class="submit"
            use:tippy={{
              content:
                "You cannot edit or delete your comment after it is posted.",
              delay: [250, 0],
            }}
            on:click={() => {
              writeComment();
              commentText = "";
              commentUsername = "";
              commentUserlink = "";
            }}
          >
            Add comment
          </button>
        </div>
      </div>
      {#if idea.comments.length > 0}
        <div class="idea-comments-wrapper">
          {#each idea.comments as comment}
            <Comment {comment} currentComment={replyTo} {replyToComment} />
          {/each}
        </div>
      {/if}
    {:else}
      <h3>Select an idea</h3>
    {/if}
  </div>
</content>

<style>
  /* 
  Build a popup like ProductHunt. There is a parent with 
  scrolling and a relative size unit as child. 
  */

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
  }

  .col2 input {
    border: 1px solid #ccc;
    width: 100%;
    border-radius: 0.3em;
    padding: 0.4em;
    font-size: 0.8em;
    margin-bottom: 0.3em;
  }

  .submit {
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
    z-index: 100;
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
</style>
