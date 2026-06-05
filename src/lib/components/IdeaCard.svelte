<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  let { idea }: { idea: { id: string; title: string; summary_md: string | null; type: string; status: string } } = $props();
</script>
<a href="/ideas/{idea.id}" class="block rounded-2xl border p-5 transition"
   style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-2 flex items-center justify-between gap-2">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={idea.status} />
  </div>
  <h3 class="font-bold" style="color:var(--ink)">{idea.title}</h3>
  {#if idea.summary_md}<p class="mt-1 line-clamp-2 text-sm" style="color:var(--muted)">{idea.summary_md}</p>{/if}
</a>
