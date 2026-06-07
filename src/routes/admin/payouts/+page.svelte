<script lang="ts">
  import { enhance } from '$app/forms';
  import { get } from 'svelte/store';
  import Money from '$lib/components/Money.svelte';
  import VerifySeal from '$lib/components/VerifySeal.svelte';
  import { makeOutcomeEnhancer, type OutcomeKind } from '$lib/review-motion';
  import { prefersReducedMotion } from '$lib/motion';

  let { data, form } = $props();
  const reduced = get(prefersReducedMotion);
  let inflight = $state<Record<string, boolean>>({});
  let shown = $state<Record<string, OutcomeKind | undefined>>({});
  let announce = $state('');

  function enhancer(id: string, kind: OutcomeKind, label: string) {
    return makeOutcomeEnhancer({
      kind, reduced,
      isPending: () => inflight[id] === true,
      markPending: () => { inflight = { ...inflight, [id]: true }; },
      showSucceeded: () => { shown = { ...shown, [id]: kind }; announce = label; },
      finish: () => {
        const i = { ...inflight }; delete i[id]; inflight = i;
        const s = { ...shown }; delete s[id]; shown = s;
      }
    });
  }
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Charitable-purpose gate</h1>
<p class="mb-4 text-sm" style="color:var(--muted)">Verified answers awaiting admin approval. Approving records the intended payout (no funds move in Phase 1).</p>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

{#if data.pending.length === 0}
  <p style="color:var(--muted)">Nothing awaiting approval.</p>
{:else}
  <span class="sr-only" aria-live="polite">{announce}</span>
  <table class="w-full text-sm">
    <thead><tr style="color:var(--faint)">
      <th class="text-left">Answer</th><th class="text-left">Idea</th><th class="text-left">Submitter</th>
      <th class="text-right">Intended</th><th></th>
    </tr></thead>
    <tbody>
      {#each data.pending as a (a.id)}
        <tr style="border-top:1px solid var(--line)" class:row-dim={shown[a.id] === 'rejecting'}>
          <td class="py-2" style="color:var(--ink)"><a href="/ideas/{a.ideas?.slug ?? a.idea_id}" style="color:var(--green-deep)">{a.title}</a></td>
          <td style="color:var(--muted)">{a.ideas?.title}</td>
          <td style="color:var(--muted)">{a.submitter?.display_name ?? a.submitter?.handle}</td>
          <td class="text-right" style="color:var(--ink)"><Money cents={a.payout_amount_cents} currency={a.payout_currency} /></td>
          <td class="py-2 text-right" class:payout-glow={shown[a.id] === 'approving'}>
            {#if shown[a.id] === 'approving'}
              <span class="inline-flex items-center gap-1 text-sm font-medium" style="color:var(--green-deep)">
                <VerifySeal play tone="verified" {reduced} /> Approved
              </span>
            {:else if !inflight[a.id]}
              <form method="POST" action="?/approve" class="inline" use:enhance={enhancer(a.id, 'approving', 'Payout approved.')}>
                <input type="hidden" name="answer_id" value={a.id} />
                <button class="mr-3" style="color:var(--green-deep)">Approve</button>
              </form>
              <form method="POST" action="?/reject" class="inline" use:enhance={enhancer(a.id, 'rejecting', 'Payout rejected.')}>
                <input type="hidden" name="answer_id" value={a.id} />
                <button style="color:var(--neg)">Reject</button>
              </form>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
