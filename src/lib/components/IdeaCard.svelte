<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  // mirrors $lib/server/idea-feed#IdeaListItem (kept inline so this client component never imports a $lib/server module)
  let { idea }: {
    idea: {
      id: string; slug: string; title: string; summary_md: string | null; type: string; status: string;
      score?: number; answerCount?: number; commentCount?: number; verified?: { id: string; title: string } | null;
    };
  } = $props();
</script>
<article class="card card-hover idea">
  <div class="idea__top">
    <span class="u-label">{idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={idea.status} />
  </div>

  <h3 class="idea__title">
    <!-- stretched link: whole card → idea; sits below the verified sub-link's z-index -->
    <a class="idea__link" href="/ideas/{idea.slug}">{idea.title}</a>
  </h3>
  {#if idea.summary_md}<p class="idea__summary">{idea.summary_md}</p>{/if}

  {#if typeof idea.score === 'number' || idea.answerCount !== undefined}
    <div class="idea__stats">
      {#if typeof idea.score === 'number'}
        <span class="score" title="Net votes"><span class="score__caret" aria-hidden="true">▲</span><span class="tnum">{idea.score}</span></span>
      {/if}
      {#if idea.answerCount !== undefined}
        <span class="idea__stat" title="Answers"><span class="tnum">{idea.answerCount}</span> {idea.answerCount === 1 ? 'answer' : 'answers'}</span>
        <span class="idea__stat" title="Comments"><span class="tnum">{idea.commentCount ?? 0}</span> {idea.commentCount === 1 ? 'comment' : 'comments'}</span>
      {/if}
    </div>
  {/if}

  {#if idea.verified}
    <a class="idea__verified" href="/ideas/{idea.slug}#answer-{idea.verified.id}">
      <span class="idea__verified-tick" aria-hidden="true">✓</span>
      <span class="idea__verified-label">Verified solution</span>
      <span class="idea__verified-title">{idea.verified.title}</span>
    </a>
  {/if}
</article>
<style>
  .idea { position: relative; display: flex; flex-direction: column; padding: 1.35rem; height: 100%; }
  .idea::after { /* green accent edge on hover */
    content: ''; position: absolute; inset: 0; border-radius: var(--r-card); pointer-events: none;
    box-shadow: inset 0 0 0 1.5px transparent; transition: box-shadow var(--dur-base) var(--ease-snappy);
  }
  .idea:hover::after { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--green) 60%, transparent); }

  .idea__top { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .idea__title { margin-top: .85rem; font-size: 1.08rem; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; }
  .idea__link { color: var(--ink); }
  .idea__link::after { content: ''; position: absolute; inset: 0; z-index: 0; border-radius: var(--r-card); }
  .idea:hover .idea__link { color: var(--green-deep); }
  .idea__summary {
    margin-top: .5rem; color: var(--muted); font-size: .9rem; line-height: 1.55;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }

  .idea__stats { margin-top: auto; padding-top: .9rem; border-top: 1px solid var(--line);
    display: flex; align-items: center; gap: .9rem; font-size: .82rem; color: var(--muted); }
  .score { display: inline-flex; align-items: center; gap: .25rem; font-weight: 700; color: var(--ink); }
  .score__caret { color: var(--green-deep); font-size: .82em; }
  .idea__stat { white-space: nowrap; }
  .idea__stat .tnum { color: var(--body); font-weight: 600; }

  /* verified solution strip - sits above the stretched link so it's independently clickable */
  .idea__verified {
    position: relative; z-index: 1; margin-top: .85rem; display: flex; align-items: center; gap: .4rem;
    padding: .55rem .7rem; border-radius: var(--r-chip); font-size: .82rem;
    background: color-mix(in srgb, var(--green) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
    transition: background var(--dur-fast) var(--ease-snappy);
  }
  .idea__verified:hover { background: color-mix(in srgb, var(--green) 16%, transparent); }
  .idea__verified-tick { flex: none; color: var(--green-deep); font-weight: 800; }
  .idea__verified-label { flex: none; font-weight: 700; color: var(--green-deep); }
  .idea__verified-title { color: var(--body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
