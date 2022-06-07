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
    const [ideas, comments, users, likes] = await Promise.all([
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
  <h2>Open impact metrics of AIS&nbsp;Safety Ideas</h2>
  <p>
    The AI safety research ideas platform commits to transparency and sharing
    our metrics. We hope this enables people to evaluate the impact of the
    platform better. Read the <a
      href="http://forum.effectivealtruism.org/posts/nxeL7XFvtQCx7hpxo/everyone-show-us-your-numbers"
      target="_blank"
      rel="noopener noreferrer"
    >
      forum
    </a> post for more details.
  </p>
  <h2 id="metrics">Metrics</h2>
  <p class="metrics-text">
    Apart Research has <span
      use:tippy={{ content: "From the FTX Future Fund regrantor program." }}
      class="inline-number">$95,000</span
    >
    in funding. The total number of ideas is
    <span class="inline-number">
      {ideas.length}
    </span>
    with <span class="inline-number">{comments.length}</span> total comments of
    which
    <span class="inline-number">
      {comments.filter((com) => com.reply_to).length}
    </span>
    are replies. Of all ideas,
    <span class="inline-number"
      >{ideas.filter((idea) => idea.verified).length}</span
    >
    are verified by expert profiles and
    <span class="inline-number"
      >{ideas.filter((idea) => idea.filtered).length}</span
    >
    are filtered by the Apart Research team and they have been liked a total of
    <span class="inline-number">{likes.length}</span>
    times. The total number of users is
    <span class="inline-number">
      {users.length}
    </span>
    and the number of expert users is
    <span class="inline-number"
      >{users.filter((user) => user.expert).length}</span
    >. The number of user interviews has been
    <span class="inline-number"> 17 </span>
  </p>

  <h3 id="commits">Website updates by day</h3>
  <div class="open-day-block" id="commit-map">
    <SvelteHeatmap
      data={[
        { date: "2022-04-16", value: 1 },
        { date: "2022-04-19", value: 1 },
        { date: "2022-04-20", value: 1 },
        { date: "2022-04-21", value: 1 },
        { date: "2022-04-22", value: 1 },
        { date: "2022-04-23", value: 1 },
        { date: "2022-04-24", value: 1 },
        { date: "2022-04-26", value: 1 },
        { date: "2022-04-27", value: 1 },
        { date: "2022-04-28", value: 1 },
        { date: "2022-04-29", value: 1 },
        { date: "2022-04-30", value: 1 },
        { date: "2022-05-15", value: 1 },
        { date: "2022-05-17", value: 1 },
        { date: "2022-05-18", value: 1 },
        { date: "2022-05-19", value: 1 },
        { date: "2022-05-20", value: 1 },
        { date: "2022-05-21", value: 1 },
        { date: "2022-05-23", value: 1 },
        { date: "2022-05-24", value: 1 },
        { date: "2022-05-25", value: 1 },
        { date: "2022-05-26", value: 1 },
        { date: "2022-05-27", value: 1 },
        { date: "2022-05-30", value: 1 },
        { date: "2022-05-31", value: 1 },
        { date: "2022-06-01", value: 1 },
        { date: "2022-06-02", value: 1 },
        { date: "2022-06-03", value: 1 },
        { date: "2022-06-05", value: 1 },
        { date: "2022-06-06", value: 1 },
        { date: "2022-06-07", value: 1 },
        { date: "2022-06-08", value: 1 },
      ]}
      endDate={moment().toDate()}
      startDate={moment("2022-04-15").toDate()}
      view="yearly"
      colors={["#44FF98"]}
      emptyColor={"#DAFFEA"}
    />
  </div>
  <h3>Website visitors</h3>
  <div class="open-graph-wrapper">
    <div class="w-embed w-iframe">
      <iframe
        width="100%"
        height="475px"
        src="https://datastudio.google.com/embed/reporting/70009ccf-f7f2-457f-bc8f-ef9dbbd6ed65/page/DbGrC"
        frameborder="0"
        style="border:0"
        allowfullscreen=""
        title="Website visitors"
      />
    </div>
  </div>
  <h2 id="roadmap">Feature roadmap</h2>
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
  </div>
</div>
<Footer />

<style>
  .metrics-text {
    font-size: 1rem;
    line-height: 1.5rem;
  }

  .inline-number {
    display: inline-block;
    text-align: center;
    padding: 0.25rem 0.5rem;
    font-style: bold;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
  }

  .w-container {
    margin: 0 auto;
    padding: 0.2em;
  }

  /* Mobile */
  @media only screen and (max-width: 600px) {
    .open-block {
      width: 100%;
      margin-bottom: 20px;
    }

    .timeline-block {
      width: 100%;
    }

    .timeline-pointer {
      display: none;
    }
  }
</style>
