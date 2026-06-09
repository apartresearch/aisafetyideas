<script lang="ts">
  import { navigating } from '$app/stores';
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  import SkeletonCard from '$lib/components/SkeletonCard.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  let { data } = $props();

  // show a skeleton grid while a client-side navigation to the ideas list is in flight
  let isNavigating = $derived(!!$navigating && $navigating.to?.url.pathname === '/ideas');

  // Infinite scroll: SSR renders page 0; we append further pages from /api/ideas. The list is local
  // $state seeded from `data`, and re-seeded whenever the filter/sort navigation changes `data`.
  // svelte-ignore state_referenced_locally
  let ideas = $state(data.ideas);
  // svelte-ignore state_referenced_locally
  let page = $state(data.page);
  // svelte-ignore state_referenced_locally
  let hasMore = $state(data.hasMore);
  let loading = $state(false);
  let failed = $state(false);
  let sentinel = $state<HTMLDivElement | null>(null);

  // re-seed only on a real filter/sort change (this key changes ⇒ a navigation happened)
  let feedKey = $derived(`${data.type ?? ''}|${data.sort}`);
  $effect(() => {
    feedKey; // track
    ideas = data.ideas;
    page = data.page;
    hasMore = data.hasMore;
    failed = false;
  });

  function buildHref(type: string | null, sort: 'top' | 'new'): string {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (sort === 'new') p.set('sort', 'new'); // 'top' (net upvotes) is the default - omit it
    const qs = p.toString();
    return qs ? `/ideas?${qs}` : '/ideas';
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    failed = false;
    try {
      const p = new URLSearchParams();
      if (data.type) p.set('type', data.type);
      if (data.sort === 'new') p.set('sort', 'new');
      p.set('page', String(page + 1));
      const res = await fetch(`/api/ideas?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      ideas = [...ideas, ...j.ideas];
      page = j.page;
      hasMore = j.hasMore;
    } catch {
      failed = true; // surface a retry control rather than silently stalling
    } finally {
      loading = false;
    }
  }

  // Auto-load when the sentinel nears the viewport (rootMargin pre-fetches before it's visible).
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });
</script>

<header class="ideas-head">
  <div>
    <span class="u-label">Open research ideas</span>
    <h1 class="ideas-title">Ideas</h1>
  </div>
  <p class="ideas-count tnum">{data.count.toLocaleString()} open</p>
</header>

<div class="ideas-controls">
  <div class="seg" role="tablist" aria-label="Filter by type">
    <a class="seg__item" aria-current={!data.type} href={buildHref(null, data.sort)}>All</a>
    <a class="seg__item" aria-current={data.type === 'hypothesis'} href={buildHref('hypothesis', data.sort)}>Hypotheses</a>
    <a class="seg__item" aria-current={data.type === 'open_ended'} href={buildHref('open_ended', data.sort)}>Open-ended</a>
  </div>
  <div class="seg" role="tablist" aria-label="Sort">
    <a class="seg__item" aria-current={data.sort === 'top'} href={buildHref(data.type, 'top')}>Top</a>
    <a class="seg__item" aria-current={data.sort === 'new'} href={buildHref(data.type, 'new')}>Newest</a>
  </div>
</div>

{#if isNavigating}
  <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {#each Array(6) as _, i (i)}<SkeletonCard />{/each}
  </div>
{:else if ideas.length === 0}
  <div class="ideas-empty card">
    <p>No ideas here yet.</p>
    {#if data.type}<a class="btn btn-secondary btn-sm" href={buildHref(null, data.sort)}>Clear filter</a>{/if}
  </div>
{:else}
  <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {#each ideas as idea (idea.id)}<IdeaCard {idea} />{/each}
  </div>

  <div class="ideas-foot">
    {#if loading}
      <Spinner label="Loading more ideas" />
    {:else if failed}
      <button onclick={loadMore} class="btn btn-secondary btn-sm">Couldn’t load - retry</button>
    {:else if hasMore}
      <!-- manual fallback (keyboard / no-IntersectionObserver); the observer auto-triggers loadMore -->
      <button onclick={loadMore} class="btn btn-ghost btn-sm">Load more</button>
    {:else}
      <span class="ideas-foot__note">That’s all {data.count.toLocaleString()} ideas.</span>
    {/if}
    <div bind:this={sentinel} aria-hidden="true"></div>
  </div>
{/if}

<style>
  .ideas-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
  .ideas-title { margin-top: .35rem; font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
  .ideas-count { color: var(--faint); font-size: .9rem; font-weight: 500; }

  .ideas-controls { margin: 1.5rem 0 1.75rem; display: flex; flex-wrap: wrap; gap: .6rem; }
  .seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-pill); }
  .seg__item {
    border-radius: var(--r-pill); padding: .4rem .9rem; font-size: .85rem; font-weight: 600; color: var(--muted);
    transition: background var(--dur-fast) var(--ease-snappy), color var(--dur-fast); white-space: nowrap;
  }
  .seg__item:hover { color: var(--ink); }
  .seg__item[aria-current='true'] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); }

  .ideas-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem 1.5rem; color: var(--muted); }

  .ideas-foot { margin-top: 2.25rem; display: flex; flex-direction: column; align-items: center; gap: .5rem; }
  .ideas-foot__note { font-size: .85rem; color: var(--faint); }
</style>
