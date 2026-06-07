<script lang="ts">
  import { formatCents } from '$lib/money';
  let { cents, currency = 'USD' }: { cents: number | null | undefined; currency?: string } = $props();
  const fmt = $derived(formatCents(cents, currency));
</script>
<span style="font-variant-numeric: tabular-nums">{fmt}</span>
