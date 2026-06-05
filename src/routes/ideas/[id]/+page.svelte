<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  let { data } = $props();
</script>
<article class="rounded-2xl border p-6" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-2 flex items-center justify-between">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{data.idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={data.idea.status} />
  </div>
  <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.idea.title}</h1>
  {#if data.author}<p class="text-sm" style="color:var(--faint)">by <a href="/u/{data.author.handle}" style="color:var(--green-deep)">{data.author.display_name ?? data.author.handle}</a></p>{/if}
  {#if data.idea.claim}<p class="mt-3 italic" style="color:var(--body)">{data.idea.claim}</p>{/if}
  {#if data.idea.summary_md}<p class="mt-3" style="color:var(--body)">{data.idea.summary_md}</p>{/if}
  {#if data.categories.length}<div class="mt-4 flex flex-wrap gap-2">{#each data.categories as c}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--line); color:var(--muted)">{c.title}</span>{/each}</div>{/if}
  {#if data.idea.source_url}<p class="mt-4 text-sm"><a href={data.idea.source_url} target="_blank" rel="noopener" style="color:var(--green-deep)">Source ↗</a></p>{/if}
</article>
