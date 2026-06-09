<script lang="ts">
  import { enhance } from '$app/forms';
  import { get } from 'svelte/store';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import VerifySeal from '$lib/components/VerifySeal.svelte';
  import CountUp from '$lib/components/CountUp.svelte';
  import { makeOutcomeEnhancer, type OutcomeKind } from '$lib/review-motion';
  import { prefersReducedMotion } from '$lib/motion';

  let { data, form } = $props();
  const reduced = get(prefersReducedMotion);

  let inflight = $state<Record<string, boolean>>({});
  let shown = $state<Record<string, OutcomeKind | undefined>>({});
  let verifiedCents = $state<Record<string, number>>({});
  let announce = $state('');

  // New-idea form: local state + bind:value so a review-action enhance re-render (or any invalidate)
  // can't wipe a half-typed idea.
  let newTitle = $state('');
  let newType = $state('open_ended');
  let newClaim = $state('');
  let newSummary = $state('');
  let newResolutionCriteria = $state('');
  let newMethodology = $state('');
  let newTheoryOfChange = $state('');
  let newExtensions = $state('');

  // AI structure audit affordance
  let auditHint = $state<{ missingSections: string[]; notes: string[] } | null>(null);
  let auditMsg = $state('');   // soft message (e.g. "AI check is for experts/supporters")
  let auditLoading = $state(false);

  async function checkStructure() {
    auditHint = null;
    auditMsg = '';
    const text = [newSummary, newResolutionCriteria, newMethodology, newTheoryOfChange, newExtensions]
      .filter(Boolean).join('\n\n');
    if (!text.trim()) { auditMsg = 'Add some content first.'; return; }
    auditLoading = true;
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'idea', text }),
      });
      if (res.status === 403) { auditMsg = 'AI check is available for experts and supporters.'; return; }
      if (!res.ok) { auditMsg = 'AI check unavailable right now.'; return; }
      auditHint = await res.json();
    } catch {
      auditMsg = 'Could not reach the AI check — try again.';
    } finally {
      auditLoading = false;
    }
  }

  function enhancer(id: string, kind: OutcomeKind, label: string) {
    return makeOutcomeEnhancer({
      kind, reduced,
      isPending: () => inflight[id] === true,
      prepare: kind === 'verifying'
        ? (input) => {
            const dollars = Number(input.formData.get('payout'));
            if (Number.isFinite(dollars)) verifiedCents = { ...verifiedCents, [id]: Math.round(dollars * 100) };
          }
        : undefined,
      markPending: () => { inflight = { ...inflight, [id]: true }; },
      showSucceeded: () => { shown = { ...shown, [id]: kind }; announce = label; },
      finish: () => {
        const i = { ...inflight }; delete i[id]; inflight = i;
        const s = { ...shown }; delete s[id]; shown = s;
      }
    });
  }
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert console</h1>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

<form method="POST" action="?/create" class="mb-8 flex flex-col gap-2 rounded-2xl border p-5"
      style="border-color:var(--line); background:var(--surface)">
  <h2 class="font-bold" style="color:var(--ink)">Post a new idea</h2>
  <input name="title" placeholder="Title" required bind:value={newTitle} class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <select name="type" bind:value={newType} class="rounded-xl border px-3 py-2" style="border-color:var(--line)">
    <option value="open_ended">Open-ended</option>
    <option value="hypothesis">Hypothesis (yes/no)</option>
  </select>
  <input name="claim" placeholder="Hypothesis claim (if hypothesis)" bind:value={newClaim} class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="summary_md" placeholder="Summary (markdown)" bind:value={newSummary} class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <p style="font-size:.75rem; color:var(--faint); margin:0">Markdown + LaTeX ($x^2$, $$\sum$$) supported</p>
  <textarea name="resolution_criteria_md" placeholder="Resolution criteria (optional, markdown)" bind:value={newResolutionCriteria} class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <textarea name="methodology_md" placeholder="Methodology (optional, markdown)" bind:value={newMethodology} class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <textarea name="theory_of_change_md" placeholder="Theory of change (optional, markdown)" bind:value={newTheoryOfChange} class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <textarea name="extensions_md" placeholder="Extensions / future directions (optional, markdown)" bind:value={newExtensions} class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <div class="flex flex-wrap items-center gap-2">
    <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Publish</button>
    <button type="button" class="rounded-xl border px-3 py-1.5 text-sm font-medium"
            style="border-color:var(--line); color:var(--body)"
            onclick={checkStructure} disabled={auditLoading}>
      {auditLoading ? 'Checking…' : 'Check structure'}
    </button>
  </div>
  {#if auditMsg}
    <p class="text-sm" style="color:var(--muted)">{auditMsg}</p>
  {/if}
  {#if auditHint}
    <div class="rounded-xl border p-3 text-sm" style="border-color:var(--line); background:var(--surface-2)">
      {#if auditHint.missingSections.length}
        <p class="mb-1 font-medium" style="color:var(--body)">Missing or thin sections:</p>
        <ul class="mb-2 list-disc pl-4" style="color:var(--body)">
          {#each auditHint.missingSections as s}<li>{s}</li>{/each}
        </ul>
      {/if}
      {#if auditHint.notes.length}
        <p class="mb-1 font-medium" style="color:var(--body)">Notes:</p>
        <ul class="list-disc pl-4" style="color:var(--muted)">
          {#each auditHint.notes as n}<li>{n}</li>{/each}
        </ul>
      {/if}
      <button type="button" class="mt-2 text-xs" style="color:var(--faint)"
              onclick={() => { auditHint = null; }}>Dismiss</button>
    </div>
  {/if}
</form>

<h2 class="mb-2 font-bold" style="color:var(--ink)">Review queue</h2>
{#if data.queue.length === 0}
  <p class="mb-8" style="color:var(--muted)">No answers awaiting review.</p>
{:else}
  <div class="mb-8 flex flex-col gap-3">
    <span class="sr-only" aria-live="polite">{announce}</span>
    {#each data.queue as a (a.id)}
      <div class="rounded-2xl border p-5"
           class:payout-glow={shown[a.id] === 'verifying'}
           class:reject-settle={shown[a.id] === 'rejecting' || shown[a.id] === 'revising'}
           class:row-dim={shown[a.id] === 'rejecting'}
           class:row-warn={shown[a.id] === 'revising'}
           style="border-color:var(--line); background:var(--surface)">
        <div class="mb-1 flex items-center justify-between gap-2">
          <div>
            <a href="/ideas/{a.ideas?.slug ?? a.idea_id}" class="font-bold" style="color:var(--ink)">{a.title}</a>
            <span class="ml-2 text-xs" style="color:var(--faint)">on “{a.ideas?.title}” · by {a.submitter?.display_name ?? a.submitter?.handle}</span>
          </div>
          {#if shown[a.id] === 'verifying'}
            <span class="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap" style="color:var(--green-deep)">
              <VerifySeal play tone="verified" {reduced} /> Verified · <CountUp cents={verifiedCents[a.id] ?? 0} {reduced} />
            </span>
          {:else}
            <StatusBadge status={a.status} />
          {/if}
        </div>
        <Markdown html={a.explanation_html} class="mb-2" />
        {#if a.answer_artifacts?.length}
          <ul class="mb-3 flex flex-col gap-1 text-sm">
            {#each a.answer_artifacts as art (art.id)}
              <li><a href={art.url} target="_blank" rel="noopener" style="color:var(--green-deep)">{art.label ?? art.kind} ↗</a></li>
            {/each}
          </ul>
        {/if}

        {#if !inflight[a.id]}
          <form method="POST" action="?/verify" class="flex flex-wrap items-end gap-2 border-t pt-3"
                style="border-color:var(--line)" use:enhance={enhancer(a.id, 'verifying', 'Answer verified.')}>
            <input type="hidden" name="answer_id" value={a.id} />
            <label class="text-xs" style="color:var(--faint)">Intended payout ($)
              <input name="payout" type="number" min="0.01" step="0.01" placeholder="0.00" required
                     class="block w-28 rounded-xl border px-2 py-1" style="border-color:var(--line)" />
            </label>
            {#if a.ideas?.type === 'hypothesis'}
              <label class="text-xs" style="color:var(--faint)">Resolution
                <select name="resolution" class="block rounded-xl border px-2 py-1" style="border-color:var(--line)">
                  <option value="yes">Yes</option><option value="no">No</option><option value="ambiguous">Ambiguous</option>
                </select>
              </label>
            {/if}
            <input name="note" placeholder="Note (optional)" class="flex-1 rounded-xl border px-2 py-1" style="border-color:var(--line)" />
            <button class="rounded-xl px-3 py-1 text-sm font-medium" style="background:var(--ink); color:#fff">Verify</button>
          </form>

          <div class="mt-2 flex gap-4">
            <form method="POST" action="?/request_revision" class="flex flex-1 gap-2"
                  use:enhance={enhancer(a.id, 'revising', 'Revision requested.')}>
              <input type="hidden" name="answer_id" value={a.id} />
              <input name="note" placeholder="What to revise" class="flex-1 rounded-xl border px-2 py-1 text-sm" style="border-color:var(--line)" />
              <button class="text-sm" style="color:var(--warn)">Request revision</button>
            </form>
            <form method="POST" action="?/reject" use:enhance={enhancer(a.id, 'rejecting', 'Answer rejected.')}>
              <input type="hidden" name="answer_id" value={a.id} />
              <button class="text-sm" style="color:var(--neg)">Reject</button>
            </form>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<h2 class="mb-2 font-bold" style="color:var(--ink)">Your ideas</h2>
{#if data.ideas.length === 0}<p style="color:var(--muted)">No ideas yet.</p>{:else}
  <ul class="flex flex-col gap-2">
    {#each data.ideas as i (i.id)}<li><a href="/ideas/{i.slug}" style="color:var(--green-deep)">{i.title}</a> <span style="color:var(--faint)">· {i.status}</span></li>{/each}
  </ul>
{/if}
