<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  let { idea }: { idea: { id: string; slug: string; title: string; summary_md: string | null; type: string; status: string; score?: number } } = $props();
</script>
<a href="/ideas/{idea.slug}" class="block rounded-2xl border p-5 transition"
   style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-2 flex items-center justify-between gap-2">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <span class="flex items-center gap-2">
      {#if typeof idea.score === 'number'}
        <span class="text-xs font-semibold tabular-nums" style="color:var(--muted)">▲ {idea.score}</span>
      {/if}
      <StatusBadge status={idea.status} />
    </span>
  </div>
  <h3 class="font-bold" style="color:var(--ink)">{idea.title}</h3>
  {#if idea.summary_md}<p class="mt-1 line-clamp-2 text-sm" style="color:var(--muted)">{idea.summary_md}</p>{/if}
</a>
