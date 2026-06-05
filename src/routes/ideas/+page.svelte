<script lang="ts">
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  let { data } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Ideas</h1>
<nav class="mb-6 flex gap-2 text-sm">
  <a href="/ideas" style="color:{data.type ? 'var(--muted)' : 'var(--green-deep)'}">All</a>
  <a href="/ideas?type=hypothesis" style="color:{data.type === 'hypothesis' ? 'var(--green-deep)' : 'var(--muted)'}">Hypotheses</a>
  <a href="/ideas?type=open_ended" style="color:{data.type === 'open_ended' ? 'var(--green-deep)' : 'var(--muted)'}">Open-ended</a>
</nav>
{#if data.ideas.length === 0}
  <p style="color:var(--muted)">No ideas yet.</p>
{:else}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.ideas as idea (idea.id)}<IdeaCard {idea} />{/each}
  </div>
{/if}
{#if data.count > data.pageSize}
  <div class="mt-6 flex gap-3" style="color:var(--muted)">
    {#if data.page > 0}<a href="/ideas?{data.type ? `type=${data.type}&` : ''}page={data.page - 1}">← Prev</a>{/if}
    {#if (data.page + 1) * data.pageSize < data.count}<a href="/ideas?{data.type ? `type=${data.type}&` : ''}page={data.page + 1}">Next →</a>{/if}
  </div>
{/if}
