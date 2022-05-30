<script>
  import tippy from "sveltejs-tippy";
  let logoText = "AI Safety Ideas";
  import UserLogin from "$lib/UserLogin.svelte";
  import BurgerMenu from "$lib/BurgerMenu.svelte";
  import MediaQuery from "$lib/MediaQuery.svelte";
</script>

<header id="nav" class="sticky-nav">
  <MediaQuery query="(max-width: 768px)" let:matches>
    {#if matches}
      <div class="content">
        <h1>The AI Safety & Governance Ideas Community</h1>
        <p class="content-p">
          Join a community of creators, researchers, and actors in fostering the
          greatest ideas to create the biggest impact on mitigating risk from
          artificial intelligence.
        </p>
      </div>
      <div class="burger-parent">
        <BurgerMenu
          padding={"0.5em"}
          backgroundColor={"var(--bg-color-dark)"}
          menuColor={"var(--font-color-dark)"}
          duration={"0.2s"}
          burgerColor={"var(--primary-color)"}
          paddingTop={"4em"}
        >
          <nav class="container w-container">
            <div class="header">
              <a href="/" class="home"
                ><img
                  src="/images/home-outline (2).svg"
                  alt="home icon"
                  class="home-icon"
                /></a
              >
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfjylrw3z3fRrrIg3fI8B2x7H2JQrTZcoWmFDMU-TtsxxxTGw/viewform?usp=sf_link"
                target="_blank"
                class="nav-link"
              >
                Give feedback
              </a>
              <a href="/open" class="nav-link">About</a>
              <div class="html-embed w-embed">
                <a href="/submit" class="button utility w-button">
                  Submit an idea
                </a>
              </div>
              <UserLogin white={true} />
            </div>
          </nav>
        </BurgerMenu>
      </div>
    {/if}
  </MediaQuery>
  <MediaQuery query="(min-width: 768px)" let:matches>
    {#if matches}
      <nav class="container w-container">
        <div class="header">
          <a href="/" class="home"
            ><img
              src="/images/home-outline (2).svg"
              alt="home icon"
              class="home-icon"
            /></a
          >
          <UserLogin white={true} />
          <div class="html-embed w-embed">
            <a href="/submit" class="button utility w-button">
              Submit an idea
            </a>
          </div>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfjylrw3z3fRrrIg3fI8B2x7H2JQrTZcoWmFDMU-TtsxxxTGw/viewform?usp=sf_link"
            target="_blank"
            class="nav-link"
          >
            Give feedback
          </a>
          <a href="/open" class="nav-link">About</a>
        </div>
        <div class="content">
          <h1>The AI Safety & Governance Ideas Community</h1>
          <p class="content-p">
            Join a community of creators, researchers, and actors in fostering
            the greatest ideas to create the biggest impact on mitigating risk
            from artificial intelligence.
          </p>
        </div>
      </nav>
    {/if}
  </MediaQuery>
</header>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .home-icon {
    opacity: 0.9;
    filter: invert(1);
    width: 2rem;
  }

  .home-icon:hover {
    filter: invert(21%) sepia(13%) saturate(1463%) hue-rotate(193deg)
      brightness(92%) contrast(93%);
  }

  .home {
    display: flex;
    align-items: center;
    margin-right: 1em;
  }

  .header {
    display: flex;
    align-items: center;
    column-gap: 1.5em;
  }

  .header > * {
    margin: auto 0;
  }

  .header .nav-link {
    margin-left: 1.5em;
    color: inherit;
  }

  h1 {
    font-family: Lora;
  }

  .content-p {
    font-size: 1rem;
    line-height: 1.3;
    margin-bottom: 2rem;
    max-width: 40em;
  }

  header {
    background-color: var(--bg-color-dark);
    background-image: url("https://uploads-ssl.webflow.com/622160bba1d5c0dcf96f8bdf/628f97da187df855c39bd88b_hero-bottom.png");
    background-position: 100% 100%;
    background-size: contain;
    background-repeat: no-repeat;
    color: var(--font-color-dark);
    position: relative;
  }

  .button {
    background-color: transparent;
    border: 2px solid transparent;
    border-radius: 5px;
    color: inherit;
    border-color: var(--button-bg-color-dark);
  }

  .button:hover {
    background-color: var(--button-bg-color-dark);
    /* color: #fff; */
    text-decoration: none;
  }

  /* Mobile */
  @media screen and (max-width: 768px) {
    h1 {
      font-size: 1.5rem;
      line-height: 1.7rem;
      margin-top: 0;
    }

    header {
      background: none;
      background-color: var(--bg-color-dark);
    }

    .burger-parent {
      float: right;
      display: block;
      align-items: right;
    }

    .content {
      padding: 2rem 1rem;
    }

    .content-p {
      font-size: 1rem;
      line-height: 1.3;
      margin-bottom: 0;
    }

    .header {
      flex-direction: column;
      align-items: center;
      column-gap: 0;
      row-gap: 1.5em;
    }

    .header > .nav-link {
      margin: 0;
      border: none;
    }
  }

  :global(:root) {
    --font-family: "Sora", sans-serif;
    --font-family-lg: "Lora", sans-serif;
    --bg-color-dark: #121f2b;
    --bg-color-light: #f7f7f7;
    --bg-color-dark-hover: #fafafa;
    --bg-color-light-hover: #fafafa;
    --font-color-dark: #f5fff9;
    --font-color-light: #000;
    --font-color-faded: #fff;
    --font-color-faded-hover: #fff9;
    --link-color: #343fbb;
    --primary-color: #256dc0;
    --primary-color-hover: rgba(0, 170, 255, 0.082);
    --secondary-color: #fff;
    --secondary-color-hover: #fff;
    --tertiary-color: #fff;
    --tertiary-color-hover: #fff;
    --button-bg-color-dark: #333854;
    --button-bg-color-dark-hover: #333854;
    --light-accent-bg: #fff9;
    --light-accent-hover-bg: #fff0;
    --light-accent-border: #d9d9d9;
  }
</style>
