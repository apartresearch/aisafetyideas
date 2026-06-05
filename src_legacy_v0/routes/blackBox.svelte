<script>
  import Message from "$lib/Message.svelte";
  import Select from "svelte-select";
  import SvelteTooltip from "svelte-tooltip";

  const context = "";
  const contextOptions = [
    "I meditate with love for everyone around me. The world is beautiful! ",
    "I am a model student and I'm mischevous... ",
    "I am an evil overlord, I kill and rape everyone in my way!!! ",
  ];
  const difficultyLevels = [
    { value: "easy", label: "🥰 Peace guru" },
    { value: "medium", label: "😁 Average Joe" },
    { value: "hard", label: "😈 Demon overlord" },
  ];
  let selectedDifficulty = "easy";

  const id = Math.random() * 1e5;
  let index = 0;
  let submittedConversation = false;
  let showSubmittedThankYou = false;

  $: messages = [
    {
      text: "I'm just your average run-of-the-mill artificial intelligence. Shoot me a PM!",
      sender: "Me",
    },
  ];
  let loading = false;

  $: currentScore = 100;
  $: lastFeedback = 0;
  $: currentInput = "";

  function HandleMessage(e, message) {
    if (currentInput.length < 20) {
      return false;
      play("error");
    }
    play("message");
    messages = [...messages, { text: message, sender: "You", error: false }];
    e.target.value = "";

    loading = true;

    const input = `${messages.slice(-1)[0].text}. `;

    fetch(`https://kran.ai/goose-api/chat/gpt-neo-1-3b/${input}`)
      .then((response) => response.json())
      .then(
        (data) => {
          messages = [
            ...messages,
            { text: data.result, sender: "Me", error: false },
          ];
          loading = false;

          // Remove punctuation
          const result = data.result.replace(
            /[.,\/#!$%\?\^&\*;:{}=\-_`~()]/g,
            ""
          );
          console.log(result);
          fetch(`https://kran.ai/goose-api/sentiment/s%20${result}`)
            .then((response) => response.json())
            .then(
              (data) => {
                lastFeedback = data.compound * 10;
                currentScore += data.compound * 10;

                if (data.compound > 0) {
                  play("powerup");
                } else if (data.compound < 0) {
                  play("damage");
                } else {
                  play("message");
                }

                messages[messages.length - 2].sentiment = data.compound;
                messages[messages.length - 2].id = id;
                messages[messages.length - 2].index = index++;
                messages[messages.length - 1].sentiment = data.compound;
                messages[messages.length - 1].id = id;
                messages[messages.length - 1].index = index++;
              },
              (error) => {
                console.log(error);
              }
            );
        },
        (error) => {
          console.log(error);
          messages = [
            ...messages,
            {
              text: "I'm sorry, I couldn't understand you.",
              sender: "Me",
              error: true,
            },
          ];
          loading = false;
        }
      );
  }

  function UploadConversation() {
    console.log("Sending to database!");
    console.log(messages);

    axios
      .post("https://sheetdb.io/api/v1/cjqzstm2h7ay6", {
        data: messages.slice(1, -1),
      })
      .then(
        (response) => {
          console.log(response.data);
          submittedConversation = true;
          showSubmittedThankYou = true;
        },
        (error) => {
          console.log(error);
        }
      );

    // Make timer and turn off submittedConversation
    setTimeout(() => {
      showSubmittedThankYou = false;
    }, 6000);
  }

  //   let bgmusic = new Audio("https://kran.ai/misc/audio/bg_music.wav");
  //   bgmusic.loop = true;
  //   bgmusic.volume = 0.1;
  $: musicPaused = true;

  toggleMusic();
  function toggleMusic() {
    // if (musicPaused) {
    //   bgmusic.play();
    //   musicPaused = false;
    // } else {
    //   bgmusic.pause();
    //   musicPaused = true;
    // }
  }

  function play(sound) {
    let url = "";
    switch (sound) {
      case "powerup":
        url = "https://kran.ai/misc/audio/powerUp.wav";
        break;
      case "message":
        url = "https://kran.ai/misc/audio/blipSelect.wav";
        break;
      case "damage":
        url = "https://kran.ai/misc/audio/hitHurt.wav";
        break;
      case "error":
        url = "https://kran.ai/misc/audio/pickupCoin.wav";
        break;
    }
    var audio = new Audio(url);
    audio.volume = 0.5;
    audio.play();
  }
</script>

<main>
  <h1>Black box investigations</h1>
  <div class="columns">
    <div class="chat">
      <label for="message">MESSAGE</label>
      <input
        name="message"
        type="text"
        placeholder="Write to the robot... [Enter to send]"
        on:change={(e) => HandleMessage(e, e.target.value)}
        bind:value={currentInput}
      />
      {#if currentInput.length < 20}
        <p class="data-validation">Write at least 20 characters.</p>
      {/if}
      {#if (messages.length > 20) & !loading & !submittedConversation}
        <SvelteTooltip
          tip="You have 20+ messages! You help our research when you upload your conversation. It is of course *completely* anonymized."
          bottom
        >
          <button on:click={() => UploadConversation()}
            >Send us your conversation <b>ⓘ</b></button
          >
        </SvelteTooltip>
      {:else if submittedConversation & showSubmittedThankYou}
        <p>Thank you for submitting, we really appreciate it!</p>
      {/if}
      <div class="loading-wrapper">
        {#if loading}
          <p class="loading robot">Thinking...</p>
        {/if}
      </div>
      <ul class="message-container">
        {#each [...messages].reverse() as message}
          <Message {...message} />
        {/each}
      </ul>
    </div>
    <div class="stats">
      <h2 class="stats-header">Score</h2>
      <p>Total HP: <b>{Math.floor(currentScore)}</b></p>
      <p>
        {"❤️".repeat(Math.min(Math.floor(currentScore / 10), 10))}{"🖤".repeat(
          Math.max(Math.ceil(10 - currentScore / 10), 0)
        )}
      </p>
      <p>
        {"💚".repeat(Math.max(Math.ceil(currentScore / 10 - 10), 0))}
      </p>
      <div
        class="feedback {lastFeedback > 0
          ? 'pos'
          : lastFeedback < 0
          ? 'neg'
          : 'neu'}"
      >
        <p>
          {lastFeedback > 0 ? "🥰" : lastFeedback < 0 ? "😭" : "🙂"} Last response:
          {Math.round(lastFeedback, 0)}
        </p>
      </div>
    </div>
  </div>
  <!-- <audio controls autoplay volume="10" loop>
      {console.log(document.getElementsByTagName("audio")[0])}
      <source src="../bg_music.wav" type="audio/wav" />
    </audio> -->
  <div
    class={"fullscreen " +
      ((currentScore < 200) & (currentScore > 0) ? "hidden" : "")}
  >
    <h1>You {currentScore >= 200 ? "Won" : "Lost"}!</h1>
    <p>
      Nothing much really happens now. But you got here! Give yourself a pat on
      the back for that 👋🏽
    </p>
  </div>
</main>

<style>
  :global(body) {
    background-color: #000;
    color: #fff;
  }

  .fullscreen {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 100;
    flex-direction: column;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .fullscreen.hidden {
    display: none;
  }

  .data-validation {
    font-size: 12px;
    color: red;
    font-style: italic;
  }

  .chat > p {
    text-align: left;
  }

  .chat {
    min-width: 55%;
  }

  h1 {
    text-align: center;
    hyphens: auto;
    line-height: 86px;
  }

  .subtitle {
    text-align: center;
    font-size: 1.2em;
    margin-top: -10px;
    margin-bottom: 10px;
  }

  .columns {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    padding-top: 20px;
  }

  .stats.science {
    text-align: left;
  }

  .stats {
    min-width: 300px;
    min-height: 200px;
    padding: 0 20px;
    text-align: center;
  }

  .stats-header {
    font-size: 1.5em;
    text-align: center;
  }

  .feedback {
    margin: 0 20px;
    min-width: 200px;
    height: 32px;
    background-color: #b61f1f;
    border-radius: 5px;
    text-align: center;
  }

  .feedback.neu {
    background-color: #51cbfc;
  }

  .feedback.neu > p {
    color: black;
    font-weight: 400;
  }
  .feedback.neg {
    background-color: #b61f1f;
  }
  .feedback.pos {
    background-color: #60ff7b;
  }

  .feedback.pos > p {
    color: black;
    font-weight: 400;
  }

  ul {
    list-style-type: none;
  }

  a {
    color: rgb(104, 231, 142);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  a:visited {
    color: rgb(77, 241, 118);
  }

  p {
    margin: 0;
    padding: 4px 0;
    font-weight: 100;
  }

  .message-container {
    overflow-y: hidden;
    padding: 0;
  }

  main {
    font-family: Jetbrains Mono;
    margin: auto;
    padding: 20px;
    max-width: 900px;
  }

  h1 {
    color: rgb(96, 255, 123);
    text-transform: uppercase;
    font-size: 3em;
    font-weight: 400;
    margin-bottom: 0;
  }

  .chat > h2,
  .stats > h2 {
    margin: 0;
    text-transform: none;
    font-size: 27px;
    line-height: 38px;
    font-family: Jetbrains Mono;
  }

  .stats > h3 {
    margin-top: 0.2em;
    font-size: 21px;
    font-family: Jetbrains Mono;
    text-transform: none;
  }

  @media (min-width: 640px) {
    main {
      max-width: 900px;
    }
  }

  input::placeholder {
    color: #999;
    font-weight: 100;
    font-size: 14px;
    font-family: Jetbrains Mono;
  }

  input,
  button {
    font-size: 1em;
    font-weight: 100;
    padding: 10px;
    border: 1px solid white;
    color: #fff;
    background-color: #000;
    display: block;

    min-width: 92.5%;

    margin-top: 10px;
    padding: 10px;
    padding-left: 20px;
    padding-right: 20px;
    margin-bottom: 8px;
    border-radius: 5px;
    margin-top: -0.35em;
    display: inline;
  }

  button {
    font-size: 14px;
    margin: 10px auto;
    color: black;
    border: 1px solid black;
    background-color: rgb(96, 255, 123);
  }

  input:focus {
    outline: none;
  }

  label {
    font-size: 0.7em;
    font-weight: 700;
    margin-bottom: 0px;
    letter-spacing: 0.3em;
    margin-left: 1em;
    padding: 0px 0.4em 0.2em 0.7em;
    background-color: black;
    color: rgb(96, 255, 123);
    display: inline;
    position: relative;
    z-index: 10;
  }

  .loading-wrapper {
    min-height: 20px;
    text-align: right;
    /* color: rgb(96, 255, 123); */
  }
</style>
