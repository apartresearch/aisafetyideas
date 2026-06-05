<script lang="ts">
  import Money from './Money.svelte';
  let { potCents, funderCount, currency = 'USD' }:
    { potCents: number; funderCount: number; currency?: string } = $props();
  const funded = $derived(potCents > 0);
</script>
<div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface-2)">
  <div class="flex items-baseline justify-between">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">Bounty pot</span>
    <span class="text-xs" style="color:var(--muted)">{funderCount} {funderCount === 1 ? 'funder' : 'funders'}</span>
  </div>
  <div class="mt-1 text-2xl font-bold" style="color:var(--ink)"><Money cents={potCents} {currency} /></div>
  <div class="mt-3 h-2 overflow-hidden rounded-full" style="background:var(--surface)">
    <div class="h-2 rounded-full"
         style="width:{funded ? 100 : 0}%; background:var(--green); transition:width var(--dur-slow) var(--ease-out-soft)"></div>
  </div>
</div>
