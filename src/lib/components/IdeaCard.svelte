<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  let { idea }: {
    idea: { id: string; slug: string; title: string; summary_md: string | null; type: string; status: string; score?: number };
  } = $props();
</script>
<a href="/ideas/{idea.slug}" class="card card-hover idea">
  <div class="idea__top">
    <span class="u-label">{idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={idea.status} />
  </div>
  <h3 class="idea__title">{idea.title}</h3>
  {#if idea.summary_md}<p class="idea__summary">{idea.summary_md}</p>{/if}
  <div class="idea__foot">
    <span class="score" title="Net votes">
      <span class="score__caret" aria-hidden="true">▲</span>
      <span class="tnum">{idea.score ?? 0}</span>
      <span class="idea__foot-label">net votes</span>
    </span>
    <span class="idea__go" aria-hidden="true">→</span>
  </div>
</a>
<style>
  .idea { display: flex; flex-direction: column; padding: 1.35rem; height: 100%; position: relative; }
  /* thin green accent edge on hover (CLAUDE.md §5 cards) */
  .idea::after {
    content: ''; position: absolute; inset: 0; border-radius: var(--r-card); pointer-events: none;
    box-shadow: inset 0 0 0 1.5px transparent; transition: box-shadow var(--dur-base) var(--ease-snappy);
  }
  .idea:hover::after { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--green) 60%, transparent); }

  .idea__top { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .idea__title { margin-top: .85rem; font-size: 1.08rem; font-weight: 700; color: var(--ink); line-height: 1.3; letter-spacing: -0.01em; }
  .idea__summary {
    margin-top: .5rem; color: var(--muted); font-size: .9rem; line-height: 1.55;
    display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  /* margin-top:auto pins the foot to the bottom so cards in a row align (and short cards get a gap) */
  .idea__foot {
    margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
  }
  .score { display: inline-flex; align-items: baseline; gap: .35rem; font-weight: 700; color: var(--ink); }
  .score__caret { color: var(--green-deep); font-size: .8em; }
  .idea__foot-label { font-size: .75rem; font-weight: 500; color: var(--faint); margin-left: .15rem; }
  .idea__go { color: var(--faint); transition: transform var(--dur-fast) var(--ease-snappy), color var(--dur-fast); }
  .idea:hover .idea__go { color: var(--ink); transform: translateX(3px); }
</style>
