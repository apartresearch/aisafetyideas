<script lang="ts">
  let { status }: { status: string } = $props();
  const label: Record<string, string> = {
    open: 'Open', resolved: 'Resolved', closed: 'Closed', draft: 'Draft', archived: 'Archived'
  };
</script>
<span class="rounded-full px-2 py-0.5 text-xs font-medium"
      style="border:1px solid var(--line); color:var(--muted);
             {status === 'open' ? 'color:var(--green-deep); border-color:var(--green);' : ''}">
  {label[status] ?? status}
</span>
