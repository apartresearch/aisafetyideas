<script lang="ts">
  let { data, form } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert vetting</h1>
{#if form?.message}<p style="color:var(--neg)">{form.message}</p>{/if}
<table class="w-full text-sm">
  <thead><tr style="color:var(--faint)"><th class="text-left">Person</th><th class="text-left">Status</th><th></th></tr></thead>
  <tbody>
    {#each data.experts as e (e.id)}
      <tr style="border-top:1px solid var(--line)">
        <td class="py-2" style="color:var(--ink)">{e.profiles?.display_name ?? e.profiles?.handle ?? e.id}</td>
        <td style="color:var(--muted)">{e.status}</td>
        <td class="py-2 text-right">
          <form method="POST" action="?/setStatus" class="inline">
            <input type="hidden" name="id" value={e.id} />
            <button name="status" value="approved" class="mr-2" style="color:var(--green-deep)">Approve</button>
            <button name="status" value="revoked" style="color:var(--neg)">Revoke</button>
          </form>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
