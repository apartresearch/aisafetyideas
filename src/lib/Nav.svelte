<script>
  import tippy from "sveltejs-tippy";
  let logoText = "AI Safety Ideas";
  import UserLogin from "$lib/UserLogin.svelte";
  import BurgerMenu from "$lib/BurgerMenu.svelte";
  import MediaQuery from "$lib/MediaQuery.svelte";

  // Parameter to show header text
  export let showText = true;
</script>

<header id="nav" class="sticky-nav">
  <MediaQuery query="(max-width: 768px)" let:matches>
    {#if matches}
      {#if showText}
        <div class="content">
          {#if process.env.PROJECT_FACTORY == "TRUE" ? true : false}
            <h1>The Alignment Project Factory</h1>
          {:else}
            <h1>Ideas for ML & AI Safety Research</h1>
          {/if}
        </div>
      {/if}
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
                  src="/images/aisi_logo_white.png"
                  alt="home icon"
                  class="home-icon"
                />AISI</a
              >
              <a href="/open" class="nav-link">About</a>
              <a href="/projects" class="nav-link">Projects</a>
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
    {:else}
      <nav class="container w-container">
        <div class="header">
          <a href="/" class="home"
            ><img
              src="/images/aisi_logo.png"
              alt="home icon"
              class="home-icon"
            />AISI</a
          >
          <UserLogin white={false} />
          <div class="html-embed w-embed">
            <a href="/submit" class="button utility w-button">
              Submit an idea
            </a>
          </div>
          <a href="/open" class="nav-link">About</a>
          <a href="/projects" class="nav-link">Projects</a>
          <a href="/users" class="nav-link">Users</a>
        </div>
        {#if showText}
          <div class="content">
            {#if process.env.PROJECT_FACTORY == "TRUE" ? true : false}
              <h1>The Alignment Project Factory</h1>
            {:else}
              <h1>Ideas for ML & AI Safety Research</h1>
            {/if}
          </div>
        {/if}
      </nav>
    {/if}
  </MediaQuery>
</header>

<style>
  p {
    text-align: center;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
  }

  .home-icon {
    opacity: 0.9;
    /* filter: invert(1); */
    width: 2rem;
    margin-right: 0.5rem;
  }

  .home:hover {
    filter: invert(21%) sepia(13%) saturate(1463%) hue-rotate(193deg)
      brightness(92%) contrast(93%);
    text-decoration: none;
  }

  .home {
    display: flex;
    align-items: center;
    margin-right: 1em;
    color: black;
  }

  .header {
    display: flex;
    align-items: center;
    column-gap: 1.5em;

    justify-content: center;
  }

  .header > * {
    margin: auto 0;
  }

  .header .nav-link {
    margin-left: 1.5em;
    color: inherit;
  }

  header {
    /* background-color: var(--bg-color-dark); */
    /* background-image: url("https://uploads-ssl.webflow.com/622160bba1d5c0dcf96f8bdf/628f97da187df855c39bd88b_hero-bottom.png"); */
    /* background-position: 100% 100%; */
    /* background-size: contain; */
    /* background-repeat: no-repeat; */
    /* color: var(--font-color-light); */
    padding-bottom: 0;
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

  :global(.tippy-content) {
    border-radius: var(--border-radius);
    color: var(--font-color-light);
    background-color: white;
    border: 1px solid var(--primary-color);
    box-shadow: var(--box-shadow);
    overflow: hidden;
    z-index: 9999;
  }

  h1 {
    display: block;
    text-align: center;
    margin: 1rem auto 0 auto;
  }

  /* Mobile */
  @media screen and (max-width: 768px) {
    h1 {
      font-size: 1.5rem;
      line-height: 1.7rem;
      margin-top: 0;
    }

    /* header {
      background: none;
      background-color: var(--bg-color-dark);
      z-index: 102;
    } */

    .burger-parent {
      float: right;
      display: block;
      align-items: right;
    }

    .content {
      padding: 0.75rem 1rem;
      max-width: 820px;
      text-align: center;
      margin: 0 auto;
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
    --bg-color-light: rgb(241, 240, 240);
    --bg-color-dark-hover: #fafafa;
    --bg-color-light-hover: #fafafa;
    --font-color-dark: #f5fff9;
    --font-color-light: #333;
    --font-color-faded: #fff;
    --font-color-faded-hover: #fff9;
    --link-color: #af69e7;
    --primary-color: #256dc0;
    --primary-color-hover: rgba(240, 250, 255, 1);
    --secondary-color: #fff;
    --secondary-color-hover: #fff;
    --tertiary-color: #fff;
    --tertiary-color-hover: #fff;
    --button-bg-color-dark: #333854;
    --button-bg-color-dark-hover: #333854;
    --light-accent-bg: #fff;
    --light-accent-hover-bg: #fff0;
    --light-accent-border: #ddd;
    --border-radius: 0;
    --box-shadow: 1px 1px 1px 0 rgba(0, 0, 0, 0.15);
    --box-shadow-hover: 0 0.5rem 1rem 0 rgba(0, 0, 0, 0.03);
    --superproject: rgba(0, 68, 255, 0.082);
    --category: #00ff6e1c;

    /* Glassmorphism */
    /* inspired by Glass UI Glassmorphism generator (https://ui.glass/generator/) */
    --as-toast-border: 1px solid rgba(209, 213, 219, 0.3);
    --as-toast-backdrop-filter: blur(8px);
    --as-toast-shadow: none;
    --as-toast-btn-border: none;
    --as-toast-info-border-color: rgba(209, 213, 219, 0.3);
    --as-toast-info-background: rgba(255, 255, 255, 0.7);
    --as-toast-warn-border-color: hsl(0, 68%, 47%, 30%);
    --as-toast-warn-background: hsla(0, 69%, 80%, 0.7);

    --expert: #ff9307;
    --early: #0a84ff;
    --mid: #ff375e;
    --late: #af52de;
    --student: #34c85a;
  }

  :global(a) {
    text-decoration: none;
    color: var(--link-color);
  }

  :global(a:hover) {
    text-decoration: underline;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background: var(--bg-color-light);
  }

  :global(.tooltip a) {
    text-decoration: none;
    color: var(--link-color);
  }

  :global(.tooltip a:hover) {
    text-decoration: underline;
  }

  /* Mobile */
  @media screen and (max-width: 768px) {
    .home {
      color: white;
    }
  }
</style>
