<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import Select from "svelte-select";

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [];

  onMount(async () => {
    ideas = await getTable("ideas");
    superprojects = await getTable("idea_superprojects");
    categories = await getTable("idea_categories");
    problems = await getTable("problems");
  });

  const getTable = async (table_name) => {
    try {
      let { data, error } = await supabase.from(table_name).select("*");
      return data.map((elm) => ({
        ...elm,
        value: elm.title,
        label: elm.title,
      }));
    } catch (err) {
      console.log(err);
    }
  };
</script>

<header id="nav" class="sticky-nav">
  <nav class="container w-container">
    <ul role="list" class="nav-grid w-list-unstyled">
      <li class="list-item">
        <a href="/" aria-current="page" class="nav-logo-link w--current">
          <img
            src="https://uploads-ssl.webflow.com/622160bba1d5c0dcf96f8bdf/62431292c50af756943fd210_ideas_icon.png"
            alt="AI safety ideas logo"
            class="nav-logo"
          />
        </a>
        <h1 class="logotext">AI Safety Research Ideas</h1>
      </li>
      <li id="w-node-_8db6f7ee-7804-6955-cbb7-65390522c9f3-81dce09d">
        <div class="html-embed w-embed">
          <button
            data-tally-open="mZqqAn"
            data-tally-hide-title="1"
            class="button utility w-button"
          >
            Submit an idea
          </button>
        </div>
      </li>
      <li><a href="#" class="button utility w-button"> Dark mode </a></li>
    </ul>
  </nav>
</header>
<h2>See ideas</h2>
{#each ideas as idea}
  <i>{idea.author}</i><br />
  <b>{idea.title}</b><br />
  {@html markdown(idea.summary)}
{:else}
  <p>No ideas found</p>
{/each}

<style>
  h2 {
    text-align: center;
  }

  .button {
    margin: 0 auto;
    display: block;
    width: 100%;
    max-width: 300px;
    padding: 10px;
    border-radius: 5px;
    background-color: #00bcd4;
    color: #fff;
    font-size: 1.2rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease-in-out;
  }

  .button:hover {
    background-color: #00bcd4;
    color: #fff;
  }

  body {
    background-color: #fafafa;
  }

  .nav-logo {
    width: 100px;
    height: 100px;
  }

  .nav-logo-link {
    text-decoration: none;
  }

  .nav-logo-link:hover {
    text-decoration: none;
  }

  .logotext {
    font-size: 1.5rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: center;
  }

  .nav-grid {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-grid li {
    list-style: none;
  }

  .nav-grid li a {
    text-decoration: none;
    color: #000;
  }

  .nav-grid li a:hover {
    text-decoration: none;
  }

  .nav-grid li a.w--current {
    text-decoration: none;
    color: #000;
  }
</style>
