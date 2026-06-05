<script lang="ts">
  let { status }: { status: string } = $props();
  const label: Record<string, string> = {
    open: 'Open', resolved: 'Resolved', closed: 'Closed', draft: 'Draft', archived: 'Archived',
    submitted: 'Submitted', under_review: 'Under review', revision_requested: 'Revision requested',
    verified: 'Verified', rejected: 'Rejected'
  };
  const tone: Record<string, 'accent' | 'neg' | 'warn'> = {
    open: 'accent', resolved: 'accent', verified: 'accent',
    rejected: 'neg', revision_requested: 'warn'
  };
  const t = $derived(tone[status]);
</script>
<span class="rounded-full px-2 py-0.5 text-xs font-medium"
      style="border:1px solid var(--line); color:var(--muted);
             {t === 'accent' ? 'color:var(--green-deep); border-color:var(--green);' : ''}
             {t === 'neg' ? 'color:var(--neg); border-color:var(--neg);' : ''}
             {t === 'warn' ? 'color:var(--warn); border-color:var(--warn);' : ''}">
  {label[status] ?? status}
</span>
