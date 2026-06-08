<script lang="ts">
  import IdeaCard from '$lib/components/IdeaCard.svelte';

  let { data } = $props();

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
    if (sort === 'new') p.set('sort', 'new'); // 'top' (net upvotes) is the default — omit it
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

<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Ideas</h1>
<nav class="mb-6 flex gap-2 text-sm">
  <a href={buildHref(null, data.sort)} style="color:{data.type ? 'var(--muted)' : 'var(--green-deep)'}">All</a>
  <a href={buildHref('hypothesis', data.sort)} style="color:{data.type === 'hypothesis' ? 'var(--green-deep)' : 'var(--muted)'}">Hypotheses</a>
  <a href={buildHref('open_ended', data.sort)} style="color:{data.type === 'open_ended' ? 'var(--green-deep)' : 'var(--muted)'}">Open-ended</a>
</nav>
<nav class="mb-6 -mt-4 flex gap-2 text-sm">
  <a href={buildHref(data.type, 'top')} style="color:{data.sort === 'top' ? 'var(--green-deep)' : 'var(--muted)'}">Top</a>
  <a href={buildHref(data.type, 'new')} style="color:{data.sort === 'new' ? 'var(--green-deep)' : 'var(--muted)'}">Newest</a>
</nav>

{#if ideas.length === 0}
  <p style="color:var(--muted)">No ideas yet.</p>
{:else}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each ideas as idea (idea.id)}<IdeaCard {idea} />{/each}
  </div>

  <!-- sentinel + status row -->
  <div class="mt-8 flex flex-col items-center gap-3">
    {#if loading}
      <span class="text-sm" style="color:var(--faint)">Loading more…</span>
    {:else if failed}
      <button onclick={loadMore} class="rounded-xl border px-4 py-2 text-sm font-medium"
              style="border-color:var(--line); color:var(--ink)">Couldn’t load — retry</button>
    {:else if hasMore}
      <!-- manual fallback (keyboard / no-IntersectionObserver); the observer auto-triggers loadMore -->
      <button onclick={loadMore} class="rounded-xl border px-4 py-2 text-sm font-medium"
              style="border-color:var(--line); color:var(--muted)">Load more</button>
    {:else}
      <span class="text-sm" style="color:var(--faint)">That’s all {data.count} ideas.</span>
    {/if}
    <div bind:this={sentinel} aria-hidden="true"></div>
  </div>
{/if}
