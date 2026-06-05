<script lang="ts">
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Charitable-purpose gate</h1>
<p class="mb-4 text-sm" style="color:var(--muted)">Verified answers awaiting admin approval. Approving records the intended payout (no funds move in Phase 1).</p>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

{#if data.pending.length === 0}
  <p style="color:var(--muted)">Nothing awaiting approval.</p>
{:else}
  <table class="w-full text-sm">
    <thead><tr style="color:var(--faint)">
      <th class="text-left">Answer</th><th class="text-left">Idea</th><th class="text-left">Submitter</th>
      <th class="text-right">Intended</th><th></th>
    </tr></thead>
    <tbody>
      {#each data.pending as a (a.id)}
        <tr style="border-top:1px solid var(--line)">
          <td class="py-2" style="color:var(--ink)"><a href="/ideas/{a.idea_id}" style="color:var(--green-deep)">{a.title}</a></td>
          <td style="color:var(--muted)">{a.ideas?.title}</td>
          <td style="color:var(--muted)">{a.submitter?.display_name ?? a.submitter?.handle}</td>
          <td class="text-right" style="color:var(--ink)"><Money cents={a.payout_amount_cents} currency={a.payout_currency} /></td>
          <td class="py-2 text-right">
            <form method="POST" action="?/approve" class="inline">
              <input type="hidden" name="answer_id" value={a.id} />
              <button class="mr-3" style="color:var(--green-deep)">Approve</button>
            </form>
            <form method="POST" action="?/reject" class="inline">
              <input type="hidden" name="answer_id" value={a.id} />
              <button style="color:var(--neg)">Reject</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
