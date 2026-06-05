<script>
  export let text = "<message content>";
  export let sender = "<message sender>";
  export let error = false;
  export let sentiment = 0;
  // export let index = 0;
</script>

<li
  class={(sender == "Me" ? "robot" : "human") +
    (error ? " error" : "") +
    (sender == "Me"
      ? sentiment > 0
        ? " positive"
        : sentiment < 0
        ? " negative"
        : " neutral"
      : "")}
>
  <!-- {sender == "Me" ? (sentiment > 0 ? "🥰" : sentiment < 0 ? "😭" : "🙂") : ""} -->
  {@html text}
  {#if sender == "Me"}
    <div class="sentiment">
      {sentiment > 0 ? "🥰 Positive:" : sentiment < 0 ? "😭 Negative:" : "🙂"}
      {sentiment != 0 ? Math.round(sentiment * 10, 2) : ""}
    </div>
  {/if}
</li>

<style>
  .robot {
    text-align: right;
    /* color: rgb(96, 255, 123); */
    border: 1px solid rgb(96, 255, 123);
    margin-left: 40px;
    margin-right: 0;
  }

  .human {
    border: 1px solid white;
    margin-right: 40px;
    margin-left: 0;
  }

  .error {
    color: red;
    border-color: red;
    font-weight: 500;
  }

  .positive {
    /* color: rgb(96, 255, 123); */
    border-color: rgb(96, 255, 123);
  }

  .negative {
    /* color: rgb(255, 96, 96); */
    border-color: rgb(255, 96, 96);
  }

  .neutral {
    /* color: #51cbfc; */
    border-color: #51cbfc;
  }

  li {
    padding: 10px;
    padding-left: 20px;
    padding-right: 20px;
    margin-bottom: 8px;
    border-radius: 5px;
  }
</style>
