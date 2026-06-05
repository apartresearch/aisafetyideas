<script>
  import Nav from "$lib/Nav.svelte";
  import Footer from "$lib/Footer.svelte";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  import { getTable } from "$lib/db";
  import SvelteHeatmap from "svelte-heatmap";
  import moment from "moment";

  let ideas = [],
    comments = [],
    users = [],
    likes = [];

  onMount(async () => {
    [ideas, comments, users, likes] = await Promise.all([
      getTable("ideas"),
      getTable("comments"),
      getTable("users"),
      getTable("idea_user_likes"),
    ]);
  });
</script>

<svelte:head>
  <title>Open data | AI safety ideas</title>
</svelte:head>

<Nav />
<div class="w-container">
  {#if process.env.PROJECT_FACTORY == "TRUE" ? true : false}
    <h2>About</h2>
    <p class="team">
      The Alignment Project Factory is a place for non-technical AI safety ideas
      to be shared and worked on.
    </p>
    <h2>Team</h2>
    <p class="team">
      You can help build this website on our <a
        href="https://github.com/apartresearch/aisafetyideas">GitHub</a
      >
      by submitting a pull request. We are always looking for new ideas to add to
      the project, so you're welcome to also visit the
      <a href="/submit">Submit an idea</a> page to submit your own ideas.
    </p>
    <div class="members">
      <div class="member">
        <img
          src="https://media-exp1.licdn.com/dms/image/C4E03AQGW_mA4o9GQFQ/profile-displayphoto-shrink_800_800/0/1650470198388?e=1664409600&v=beta&t=bLgDMQVPG5O6DY7-fDyrgxDB7vfH5-ShT3BOpi4Hu9w"
          alt="Team member nicole"
        />
        <h3>Nicole Nohemi</h3>
        <p>
          Alignment Projects Founder,
          <a href="mailto:nnmauthe@apartresearch.com" class="contact">contact</a
          >
        </p>
      </div>
      <div class="member">
        <img
          src="https://media-exp2.licdn.com/dms/image/C5603AQGtXh8ofQbCOA/profile-displayphoto-shrink_800_800/0/1651368132506?e=1660176000&v=beta&t=Gai4wfy_Fs8hPXf1AcEtNiQpyRVX2Pewo4fOLFPqKRI"
          alt="Team member esben"
        />
        <h3>Esben Kran</h3>
        <p>
          Technical Lead,
          <a href="mailto:esben@apartresearch.com" class="contact">contact</a>
        </p>
      </div>
      <div class="member">
        <img
          src="https://media-exp1.licdn.com/dms/image/C4D03AQEDLia0L51EYQ/profile-displayphoto-shrink_800_800/0/1559148358144?e=1664409600&v=beta&t=J0MdDBLVVk_XSW7AiidtaNDIl4JelTc58szf8gmQSBI"
          alt="Team member Yonatan"
        />
        <h3>Yonatan Cale</h3>
        <p>
          Collaborator, <a href="mailto:yonatan.cale@gmail.com" class="contact"
            >contact</a
          >
        </p>
      </div>
      <div class="member">
        <img
          src="https://cdn.discordapp.com/avatars/756254556811165756/463983d257751e248f3c48f7916ae28d.webp?size=240"
          alt="Team member plex"
        />
        <h3>Plex</h3>
        <p>
          Collaborator, <a href="mailto:hello@plex.ventures" class="contact"
            >contact</a
          >
        </p>
      </div>
    </div>
  {:else}
    <h2>About</h2>
    <p class="team">
      The AI Safety Ideas platform is a public Apart tool used for collecting
      research in AI safety, collaborate on projects, and facilitate mentorship.
    </p>
    <h2>Team</h2>
    <p class="team">
      The <a href="https://apartresearch.com">Apart Research</a> team, we have
      multiple volunteers and collaborators that have joined on our
      <a href="https://apartresearch.com/join">Discord</a> and in our other projects.
    </p>
    <iframe src="https://apartresearch.com/about-embed" class="team-embed" />
  {/if}
  <h2>Open impact metrics of AI Safety Ideas</h2>
  <p>
    The AI safety research ideas platform commits to transparency and sharing
    our metrics. We hope this enables easier evaluation of the platform's
    impact. Read the <a
      href="http://forum.effectivealtruism.org/posts/nxeL7XFvtQCx7hpxo/everyone-show-us-your-numbers"
      target="_blank"
      rel="noopener noreferrer"
    >
      forum post
    </a> for more details.
  </p>
  <h2 id="metrics">Metrics</h2>
  <p class="metrics-text">
    On <a href="/">aisafetyideas.com</a>, the total number of ideas is
    <span
      class="inline-number"
      use:tippy={{
        content: "The total number of ideas on the site.",
      }}
    >
      {ideas.length}
    </span>
    with
    <span
      class="inline-number"
      use:tippy={{
        content: "Total comments on the site.",
      }}>{comments.length}</span
    >
    total comments of which
    <span
      class="inline-number"
      use:tippy={{
        content: "Total replies on the site.",
      }}
    >
      {comments.filter((com) => com.reply_to).length}
    </span>
    are replies. Of all ideas,
    <span
      class="inline-number"
      use:tippy={{
        content: "Ideas filtered by the Apart Research team.",
      }}>{ideas.filter((idea) => idea.filtered).length}</span
    >
    are filtered by the Apart Research team and they have been liked a total of
    <span
      class="inline-number"
      use:tippy={{
        content: "Total amount of likes of ideas on the site.",
      }}>{likes.length}</span
    >
    times. The total number of users is
    <span
      class="inline-number"
      use:tippy={{
        content: "Total amount of users on the site.",
      }}
    >
      {users.length}
    </span>.
  </p>
  <h3>Website visitors</h3>
  <div class="open-graph-wrapper">
    <div class="w-embed w-iframe">
      <div
        id="chart"
        data-hostname="aisafetyideas.com"
        style="aspect-ratio: 2/1"
      >
        <p style="margin: 0">Loading chart...</p>
      </div>
      <script
        async
        data-chart-selectors="#chart"
        src="https://scripts.simpleanalyticscdn.com/embed.js"></script>
    </div>
  </div>
  <!-- <h2 id="roadmap">Feature roadmap</h2>
  <div class="timeline-wrapper">
    <div class="timeline-block past">
      <h3 class="list-idea-header">Version 0.1</h3>
      <p class="list-idea-summary">
        The first version was <a
          href="https://docs.google.com/spreadsheets/u/2/d/1Ep8Dd52c00kxWvu75btazHEdPSA7jVJwrY51jKfPSBo/edit#gid=719912604"
          target="_blank">this spreadsheet.</a
        >
      </p>
    </div>
    <div class="timeline-pointer">👉🏼</div>
    <div class="timeline-block past">
      <h3 class="list-idea-header">Version 0.2</h3>
      <p class="list-idea-summary">
        A list of ideas on a website designed for the purpose. Include links to
        more info.
      </p>
    </div>
    <div class="timeline-pointer">👉🏼</div>
    <div class="timeline-block">
      <h3 class="list-idea-header">Version 0.3</h3>
      <p class="list-idea-summary">
        Add active RFPs as links. Upvoting and sharing of ideas. Make ideas
        "shovel-ready".
      </p>
    </div>
    <div class="timeline-pointer">👉🏼</div>
    <div class="timeline-block">
      <h3 class="list-idea-header">Version 0.4</h3>
      <p class="list-idea-summary">
        Showcasing upvotes on ideas, enabling bounties and RFPs.
      </p>
    </div>
    <div class="timeline-pointer">👉🏼</div>
    <div class="timeline-block">
      <h3 class="list-idea-header">Version 0.5</h3>
      <p class="list-idea-summary">
        Adding comments to ideas. Possibly integrated with the AF&nbsp;comment
        system.
      </p>
    </div>
    <div class="timeline-pointer">👉🏼</div>
    <div class="timeline-block">
      <h3 class="list-idea-header">Version 0.6</h3>
      <p class="list-idea-summary">
        Profiles implemented e.g. from LW. Add idea categories. Profile pages.
      </p>
    </div>
    <div class="timeline-pointer">👉🏼</div>
    <div class="timeline-block">
      <h3 class="list-idea-header">Version 0.7</h3>
      <p class="list-idea-summary">
        Create a networked incentive system for mentorship. Any ideas here are
        appreciated.
      </p>
    </div>
  </div> -->
</div>
<Footer />

<style>
  .members {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: left;
    align-items: flex-start;
    column-gap: 1rem;
    row-gap: 1rem;
  }

  .member {
    display: flex;
    flex-direction: column;
    max-width: 15rem;
    padding: 0.9rem;
    border: 1px solid #ccc;
    border-radius: 0.5rem;
  }

  .member > img {
    width: 100%;
    border-radius: 0.5rem;
    filter: grayscale(10%);
  }

  .member > h3 {
    margin-top: 1rem;
    margin-bottom: 0rem;
  }

  .member > p {
    margin: 0;
  }

  .metrics-text {
    font-size: 1rem;
    line-height: 1.75rem;
  }

  .inline-number {
    display: inline-block;
    line-height: 1rem;
    text-align: center;
    padding: 0.1rem 0.3rem;
    margin: 0 0.1rem;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
    font-style: bold;
    transition: 0.2s ease-in-out transform, 0.2s ease-in-out background-color;
    cursor: cell;
  }

  .inline-number:hover {
    transform: translate(0, -0.1rem);
    background-color: #eee;
  }

  .w-container {
    margin: 0 auto;
    padding: 0 0.5rem;
  }

  /* Mobile */
  @media only screen and (max-width: 600px) {
    .open-block {
      width: 100%;
      margin-bottom: 20px;
    }

    .members {
      justify-content: center;
    }

    .timeline-block {
      width: 100%;
    }

    .timeline-pointer {
      display: none;
    }
    .team-embed {
      height: 800px;
    }
  }

  .team-embed {
    width: 100%;
    min-height: 650px;
    border: none;
  }
</style>
