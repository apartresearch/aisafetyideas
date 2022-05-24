<script>
  import tippy from "sveltejs-tippy";
  let logoText = "AI Safety Ideas";
</script>

<header id="nav" class="sticky-nav">
  <nav class="container w-container">
    <ul role="list" class="nav-grid w-list-unstyled">
      <li class="list-item">
        <a href="/" aria-current="page" class="nav-logo-link w--current">
          <img
            title="Navigate to front page"
            src="/images/ideas_icon.png"
            alt="AI safety ideas logo"
            class="nav-logo"
          />
        </a>
        <h1 class="logotext">
          {logoText}
        </h1>
      </li>

      <li
        id="w-node-_8db6f7ee-7804-6955-cbb7-65390522c9f3-81dce09d"
        class="right-nav-wrapper"
      >
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSfjylrw3z3fRrrIg3fI8B2x7H2JQrTZcoWmFDMU-TtsxxxTGw/viewform?usp=sf_link"
          target="_blank"
          class="nav-link"
        >
          Give feedback
        </a>
        <a href="/open" class="nav-link"> About </a>
        <div class="html-embed w-embed">
          <a href="/submit" class="button utility w-button"> Submit an idea </a>
        </div>
      </li>
    </ul>
  </nav>
</header>

<style>
  .right-nav-wrapper {
    display: flex;
    flex-direction: row;
    column-gap: 2.5em;
    row-gap: 1em;
    flex-wrap: wrap;
    justify-content: center;
  }
  .sticky-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    padding: 5px;
  }

  .sticky-nav .nav-grid {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    margin-bottom: 20px;
    left: 0;
  }

  .button {
    background-color: transparent;
    border: 2px solid #000;
    border-radius: 5px;
    color: #000;
  }

  .button:hover {
    background-color: #44ff98;
    /* color: #fff; */
    text-decoration: none;
  }

  /* Mobile */
  @media screen and (max-width: 768px) {
    .sticky-nav {
      position: relative;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: 5px;
    }

    .sticky-nav .nav-grid {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      margin: 0;
      padding: 0;
      left: 0;
    }

    .open {
      width: 100%;
    }
  }
</style>
