<script lang="ts">
  import { barPercents } from '$lib/funding';
  let { series, format }:
    { series: { label: string; value: number }[]; format?: (v: number) => string } = $props();
  const pcts = $derived(barPercents(series.map((s) => s.value)));
  const fmt = (v: number) => (format ? format(v) : String(v));
</script>
{#if series.length === 0}
  <p style="color:var(--muted)">No data yet.</p>
{:else}
  <div class="flex flex-col gap-2">
    {#each series as s, i (s.label + i)}
      <div class="flex items-center gap-3 text-sm">
        <span class="w-32 shrink-0 truncate" style="color:var(--muted)" title={s.label}>{s.label}</span>
        <div class="h-3 flex-1 overflow-hidden rounded-full" style="background:var(--surface-2)">
          <div class="h-3 rounded-full"
               style="width:{pcts[i]}%; background:var(--chart-1); transition:width var(--dur-slow) var(--ease-out-soft)"></div>
        </div>
        <span class="w-20 shrink-0 text-right tabular-nums" style="color:var(--ink)">{fmt(s.value)}</span>
      </div>
    {/each}
  </div>
{/if}
