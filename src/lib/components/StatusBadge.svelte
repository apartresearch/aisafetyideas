<script lang="ts">
  let { status }: { status: string } = $props();
  const label: Record<string, string> = {
    open: 'Open', resolved: 'Resolved', closed: 'Closed', draft: 'Draft', review: 'In review', archived: 'Archived',
    submitted: 'Submitted', under_review: 'Under review', revision_requested: 'Revision requested',
    verified: 'Verified', rejected: 'Rejected'
  };
  const tone: Record<string, 'accent' | 'neg' | 'warn'> = {
    open: 'accent', resolved: 'accent', verified: 'accent',
    rejected: 'neg', revision_requested: 'warn'
  };
  let t = $derived(tone[status] ?? 'neutral');
</script>
<span class="badge" data-tone={t}>{label[status] ?? status}</span>
<style>
  .badge {
    display: inline-flex; align-items: center; border-radius: var(--r-chip);
    padding: .22rem .55rem; font-size: .72rem; font-weight: 600; line-height: 1; white-space: nowrap;
    border: 1px solid var(--line-strong); color: var(--muted); background: var(--surface);
  }
  .badge[data-tone='accent'] { color: var(--green-deep);
    border-color: color-mix(in srgb, var(--green) 55%, transparent);
    background: color-mix(in srgb, var(--green) 10%, transparent); }
  .badge[data-tone='neg'] { color: var(--neg);
    border-color: color-mix(in srgb, var(--neg) 45%, transparent);
    background: color-mix(in srgb, var(--neg) 8%, transparent); }
  .badge[data-tone='warn'] { color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 45%, transparent);
    background: color-mix(in srgb, var(--warn) 8%, transparent); }
</style>
