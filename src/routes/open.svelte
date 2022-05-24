<script>
  import Nav from "$lib/Nav.svelte";
  import Footer from "$lib/Footer.svelte";
  import { onMount } from "svelte";
  import tippy from "sveltejs-tippy";
  import { getTable } from "$lib/db";

  let ideas = [],
    comments = [];

  onMount(async () => {
    ideas = await getTable("ideas");
    comments = await getTable("comments");
  });
</script>

<svelte:head>
  <title>Open data | AI safety ideas</title>
</svelte:head>

<Nav />
<div class="w-container">
  <h1>
    <a
      href="https://forum.effectivealtruism.org/posts/nxeL7XFvtQCx7hpxo/everyone-show-us-your-numbers"
      target="_blank">Open impact metrics</a
    > of AIS&nbsp;Research Ideas
  </h1>
  <p>
    <a href="/">The AI safety research ideas</a> platform commits to
    transparency and sharing our metrics. Our impact evaluations are related to
    the amount of people that use the website, interact with ideas, and how many
    projects are supported by validated researchers. Check out our
    <a href="https://manifold.markets/kran">prediction markets on Manifold</a>!
  </p>
  <h2 id="metrics">Metrics</h2>
  <p>These metrics will be updated as we launch.</p>
  <div class="hori-fles-wrapper">
    <div class="open-block">
      <div class="open-block-title">Time since launch</div>
      <div class="open-block-number">T-1 weeks</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Funding secured*</div>
      <div
        class="open-block-number"
        use:tippy={{ content: "From the FTX Future Fund regrantor program." }}
      >
        $95,000
      </div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total profiles</div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total expert profiles*</div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total ideas</div>
      <div class="open-block-number">{ideas.length}</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total filtered ideas*</div>
      <div
        class="open-block-number"
        use:tippy={{
          content: "* Includes ideas that have been filtered by our team.",
        }}
      >
        {ideas.filter((idea) => idea.filtered).length}
      </div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total verified ideas*</div>
      <div
        class="open-block-number"
        use:tippy={{
          content: "* Includes ideas that have been verified by an expert.",
        }}
      >
        {ideas.filter((idea) => idea.verified).length}
      </div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total comments</div>
      <div class="open-block-number">{comments.length}</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total replies*</div>
      <div
        class="open-block-number"
        use:tippy={{
          content: "* Comments that are replies to other comments.",
        }}
      >
        {comments.filter((com) => com.reply_to).length}
      </div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Ideas with mentorship</div>
      <div class="open-block-number">
        {ideas.filter((idea) => idea.mentorship_from).length}
      </div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Likes of ideas</div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">External meetings</div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total visitors</div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">User interviews</div>
      <div class="open-block-number">14</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Total commits</div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">
        <a
          href="https://www.investopedia.com/terms/m/monthly-active-user-mau.asp"
          >MAU*</a
        >
      </div>
      <div class="open-block-number">?</div>
    </div>
    <div class="open-block">
      <div class="open-block-title">Employees</div>
      <div class="open-block-number">1.5</div>
    </div>
  </div>
  <h3 id="commits">Website updates by day</h3>
  <div class="open-day-block">
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day yes" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day" />
    <div class="open-day yes" />
    <div class="open-day" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day" />
    <div class="open-day yes" />
    <div class="open-day yes" />
    <div class="open-day yes" />
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
