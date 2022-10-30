<script>
  import tippy from "sveltejs-tippy";
  let logoText = "AI Safety Ideas";
  import UserLogin from "$lib/UserLogin.svelte";
  import BurgerMenu from "$lib/BurgerMenu.svelte";
  import MediaQuery from "$lib/MediaQuery.svelte";

  // Parameter to show header text
  export let showText = false;
</script>

<header id="nav" class="sticky-nav">
  <nav class="container">
    <MediaQuery query="(max-width: 768px)" let:matches>
      {#if matches}
        <div class="burger-parent">
          <a href="/" class="home"
            ><img
              src="/images/aisi_logo.png"
              alt="home icon"
              class="home-icon"
            />
            <h1>AISI</h1>
          </a>
          <BurgerMenu
            backgroundColor={"white"}
            duration={"0.1"}
            padding={"0.75rem"}
          >
            <div class="right">
              <a href="/" class="home"
                ><img
                  src="/images/aisi_logo.png"
                  alt="home icon"
                  class="home-icon"
                />
                <h1>AISI</h1>
              </a>
              <a href="/open" class="navlink">About</a>
              <a href="/projects" class="navlink">Projects</a>
              <a href="/users" class="navlink">Users</a>
              <a href="/submit" class="button"> Submit idea </a>
              <UserLogin white={false} />
            </div>
          </BurgerMenu>
        </div>
      {:else}
        <a href="/" class="home"
          ><img src="/images/aisi_logo.png" alt="home icon" class="home-icon" />
          <h1>AISI</h1>
        </a>
        <div class="right">
          <a href="/open" class="navlink">About</a>
          <a href="/projects" class="navlink">Projects</a>
          <a href="/users" class="navlink">Users</a>
          <UserLogin white={false} />
          <a href="/submit" class="button"> Submit idea </a>
        </div>
      {/if}
    </MediaQuery>
  </nav>
</header>

<style>
  .home-icon {
    width: 2rem;
    margin-right: 0.2rem;
  }

  .home:hover {
    filter: var(--primary-color-filter);

    text-decoration: none;
  }

  .home {
    text-align: center;
    display: flex;
    align-items: center;
    opacity: 0.9;
    margin: 0 0.4rem;
  }

  .home > h1 {
    margin: 0;
    margin-bottom: -0.25rem;
    font-size: 2.5rem;
    color: #252525;
    font-weight: 900;
  }

  header {
    width: 100%;
    margin: 0;
    padding: 0;
    background-color: white;
    border-bottom: 1px solid #eaeaea;
    position: static;
  }

  .container {
    display: flex;
    width: 100%;
    max-width: 1100px;
    justify-content: space-between;
    margin: 0 auto;
    padding: 0.5rem 0 0.5rem 0;
  }

  .right {
    display: flex;
    column-gap: 1rem;
    row-gap: 2rem;
    align-items: center;
    justify-content: center;
  }

  .navlink {
    font-size: 1rem;
    line-height: 1.1rem;
    opacity: 0.9;
    text-decoration: none;
    color: #252525;
    transition: all 0.1s ease-out;
    padding: 0 1.5rem 0 0;
  }

  .navlink:hover {
    opacity: 1;
    color: var(--link-color);
  }

  :global(.button) {
    padding: 0.7rem 1.1rem;
    border-radius: 0.2rem;
    font-size: 1rem;
    line-height: 1rem;
    font-weight: 400;
    border: none;
    transition: all 0.1s ease-out;
    border: 0.1rem solid black;
    background-color: white;
    color: black;
  }

  :global(.button:hover) {
    opacity: 1;
    background-color: var(--primary-color-light);
    text-decoration: none;
  }

  :global(.tippy-content) {
    border-radius: var(--border-radius);
    border: none;
    background-color: black;
    color: white;
    overflow: hidden;
    opacity: 0.9;
    z-index: 9999;
  }

  /* Mobile */
  @media screen and (max-width: 768px) {
    .right {
      flex-direction: column;
    }
    .navlink {
      padding: 0;
      margin: 0;
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
    --link-color: #0a84ff;
    --primary-color: #0a84ff;
    --primary-color-light: #7ea9ea;
    --primary-color-filter: invert(29%) sepia(83%) saturate(1901%)
      hue-rotate(201deg) brightness(111%) contrast(101%);
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
    --open: #0a84ff;
    --negative: #ff375e;
    --positive: #34c85a;
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

  :global(h4),
  :global(h3),
  :global(h2) {
    font-weight: 400;
  }

  /* Mobile */
  @media screen and (max-width: 768px) {
    .home {
      color: white;
    }
  }
</style>
