<script lang="ts">
  let { cents, currency = 'USD' }: { cents: number | null | undefined; currency?: string } = $props();
  const fmt = $derived(
    cents == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
  );
</script>
<span style="font-variant-numeric: tabular-nums">{fmt}</span>
