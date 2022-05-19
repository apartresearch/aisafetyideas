<script>
  import supabase from "$lib/db";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  import markdown from "$lib/drawdown";
  import Nav from "$lib//Nav.svelte";
  import Idea from "$lib/Idea.svelte";
  import IdeaViewer from "$lib/IdeaViewer.svelte";
  import CategoryTag from "$lib/CategoryTag.svelte";
  import LoadIcon from "$lib/LoadIcon.svelte";
  import Footer from "$lib/Footer.svelte";

  let url = ``,
    ideaParam = "",
    categoryParam = "";
  // console.log($page.url.searchParams.has("meme"));

  let ideas = [],
    superprojects = [],
    categories = [],
    problems = [],
    categoryRelations = [],
    superprojectRelations = [],
    problemRelations = [],
    ideaRelations = [],
    currentIdea = {},
    loaded = false,
    selectedCategories = [],
    shownIdeas = [];

  let visible = false;

  onMount(async () => {
    console.log("Refreshed");

    // Create event listener to listen for back button clicks
    window.addEventListener("popstate", () => {
      updateFromUrl();
    });

    let startTime = performance.now();
    [
      ideas,
      superprojects,
      categories,
      problems,
      categoryRelations,
      superprojectRelations,
      problemRelations,
      ideaRelations,
    ] = await Promise.all([
      getTable("ideas"),
      getTable("superprojects"),
      getTable("categories"),
      getTable("problems"),
      getTable("idea_category_relation"),
      getTable("idea_superproject_relation"),
      getTable("idea_problem_relation"),
      getTable("idea_idea_relation"),
    ]);
    let endTime = performance.now();

    console.log(`Time to load data: ${endTime - startTime}ms`);

    ideas.forEach((idea) => {
      idea.categories = categoryRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.superprojects = superprojectRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.problems = problemRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.ideas = ideaRelations.filter(
        (relation) => relation.idea === idea.id
      );
      idea.categories.forEach((category) => {
        category.category = categories.find(
          (cat) => cat.id === category.category
        );
      });
      idea.superprojects.forEach((superproject) => {
        superproject.superproject = superprojects.find(
          (sp) => sp.id === superproject.superproject
        );
      });
      idea.problems.forEach((problem) => {
        problem.problem = problems.find((p) => p.title === problem.problem);
      });
      idea.shown = true;
    });

    loaded = true;
    shownIdeas = ideas;
    updateFromUrl();
  });

  const getTable = async (table_name, grabTitle = true) => {
    try {
      let { data, error } = await supabase.from(table_name).select("*");
      return data.map((elm) => ({
        ...elm,
        value: grabTitle ? elm.title : "",
        label: grabTitle ? elm.title : "",
      }));
    } catch (err) {
      console.log(err);
    }
  };

  const selectIdea = (idea) => {
    if (loaded) {
      currentIdea = idea;
      setVisible(true);
      url.searchParams.set("idea", idea.id);
      window.history.pushState(null, document, url.href);
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };

  const setVisible = (bowl) => {
    visible = bowl;
    url.searchParams.delete("idea");
    window.history.pushState(null, document, url.href);
  };

  const selectCategory = (category) => {
    if (loaded) {
      if (selectedCategories.includes(category)) {
        selectedCategories.splice(selectedCategories.indexOf(category), 1);
        selectedCategories = selectedCategories;
      } else {
        selectedCategories = [...selectedCategories, category];
      }

      url.searchParams.set("categories", selectedCategories.join(","));
      if (selectedCategories.join(",").length < 1) {
        url.searchParams.delete("categories");
      }
      window.history.pushState(null, document, url.href);

      categories.forEach((elm) => {
        elm.selected = selectedCategories.includes(elm.title);
      });
      categories = categories;

      // Filter which ideas are shown based on selectedCategories
      ideas.forEach((idea) => {
        if (
          idea.categories.find((category) => {
            return selectedCategories.includes(category.category.title);
          }) ||
          selectedCategories.length === 0
        ) {
          idea.shown = true;
        } else {
          idea.shown = false;
        }
      });

      shownIdeas = ideas.filter((idea) => idea.shown);
    } else {
      console.log("Cannot click before it has loaded.");
    }
  };

  const updateFromUrl = () => {
    url = new URL(window.location.href);
    ideaParam = url.searchParams.get("idea");
    categoryParam = url.searchParams.get("categories");

    if (ideaParam) {
      selectIdea(ideas.find((idea) => idea.id == ideaParam));
      if (!currentIdea) {
        currentIdea = {};
      }
    }

    if (categoryParam) {
      categoryParam = categoryParam.split(",");
      categoryParam.forEach((title) => {
        if (categories.find((cat) => cat.title == title)) selectCategory(title);
      });
    }
    if (
      categoryParam &&
      categories.find((category) => category.id == categoryParam)
    ) {
      selectCategory(categories.find((cat) => cat.id == categoryParam).title);
    }

    if (!ideaParam && !categoryParam) {
      setVisible(false);
    }
  };
</script>

<Nav />

<div class="container w-container">
  <a class="page-author" href="https://apartresearch.com">Apart Research</a>
  <h1 class="page-title">The AI Safety & Governance Ideas Directory</h1>
  <p>
    This is a directory of AI safety and governance ideas. The ideas are
    shovel-ready for development and are linked to categories and superprojects
    (aka agendas).
  </p>

  {#if loaded}
    <div class="ideas-col">
      <div class="idea-categories-wrapper">
        {#each categories as cat, i}
          <CategoryTag
            {cat}
            {selectCategory}
            filter={true}
            selected={cat.selected}
          />
        {/each}
      </div>

      {#if loaded}
        {#each shownIdeas as idea}
          <Idea {idea} {selectIdea} {selectCategory} />
        {:else}
          <p>No ideas found</p>
        {/each}
      {/if}
    </div>
  {:else}
    <LoadIcon />
  {/if}
  <IdeaViewer idea={currentIdea} {visible} {setVisible} />
</div>
<Footer />

<style>
  .container {
    margin: 80px auto;
    margin-bottom: 200px;
    max-width: 800px;
    min-height: 800px;
  }

  .ideas-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 0;
    padding: 0;
    margin-bottom: 20px;
    left: 0;
  }

  .idea-categories-wrapper {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: start;
    align-items: center;
  }

  :global(a) {
    text-decoration: none;
    color: #02da6e;
  }

  :global(a:hover) {
    text-decoration: underline;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f7f7f7;
  }
  :global(.tooltip a) {
    text-decoration: none;
    color: #44ff98;
  }
  :global(.tooltip a:hover) {
    text-decoration: underline;
  }

  .page-author {
    font-size: 0.8em;
    color: #000;
  }

  .page-title {
    font-size: 1.5em;
    line-height: 1.2em;
    font-weight: bold;
    margin: 5px 0;
  }

  /* mobile style */
  @media (max-width: 768px) {
    .idea-categories-wrapper {
      flex-wrap: nowrap;
      overflow: auto;
    }

    .container {
      padding: 0 10px;
    }
  }
</style>
