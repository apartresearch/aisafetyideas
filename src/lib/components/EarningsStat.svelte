<script lang="ts">
  import Money from './Money.svelte';
  let {
    lifetimeCents,
    payoutCount
  }: { lifetimeCents: number; payoutCount: number } = $props();
</script>

{#if lifetimeCents > 0}
  <div class="flex flex-wrap gap-6" data-testid="earnings-stat">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider" style="color:var(--faint);letter-spacing:.06em">Lifetime earnings</p>
      <p class="mt-0.5 text-lg font-bold" style="color:var(--ink);font-variant-numeric:tabular-nums" data-testid="lifetime-amount">
        <Money cents={lifetimeCents} />
      </p>
    </div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider" style="color:var(--faint);letter-spacing:.06em">Verified answers</p>
      <p class="mt-0.5 text-lg font-bold" style="color:var(--ink);font-variant-numeric:tabular-nums" data-testid="payout-count">{payoutCount}</p>
    </div>
  </div>
{/if}
