<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert console</h1>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

<form method="POST" action="?/create" class="mb-8 flex flex-col gap-2 rounded-2xl border p-5"
      style="border-color:var(--line); background:var(--surface)">
  <h2 class="font-bold" style="color:var(--ink)">Post a new idea</h2>
  <input name="title" placeholder="Title" required class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <select name="type" class="rounded-xl border px-3 py-2" style="border-color:var(--line)">
    <option value="open_ended">Open-ended</option>
    <option value="hypothesis">Hypothesis (yes/no)</option>
  </select>
  <input name="claim" placeholder="Hypothesis claim (if hypothesis)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="summary_md" placeholder="Summary (markdown)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Publish</button>
</form>

<h2 class="mb-2 font-bold" style="color:var(--ink)">Review queue</h2>
{#if data.queue.length === 0}
  <p class="mb-8" style="color:var(--muted)">No answers awaiting review.</p>
{:else}
  <div class="mb-8 flex flex-col gap-3">
    {#each data.queue as a (a.id)}
      <div class="rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface)">
        <div class="mb-1 flex items-center justify-between gap-2">
          <div>
            <a href="/ideas/{a.idea_id}" class="font-bold" style="color:var(--ink)">{a.title}</a>
            <span class="ml-2 text-xs" style="color:var(--faint)">on “{a.ideas?.title}” · by {a.submitter?.display_name ?? a.submitter?.handle}</span>
          </div>
          <StatusBadge status={a.status} />
        </div>
        {#if a.explanation_md}<p class="mb-2 whitespace-pre-wrap text-sm" style="color:var(--body)">{a.explanation_md}</p>{/if}
        {#if a.answer_artifacts?.length}
          <ul class="mb-3 flex flex-col gap-1 text-sm">
            {#each a.answer_artifacts as art (art.id)}
              <li><a href={art.url} target="_blank" rel="noopener" style="color:var(--green-deep)">{art.label ?? art.kind} ↗</a></li>
            {/each}
          </ul>
        {/if}

        <form method="POST" action="?/verify" class="flex flex-wrap items-end gap-2 border-t pt-3" style="border-color:var(--line)">
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
          <form method="POST" action="?/request_revision" class="flex flex-1 gap-2">
            <input type="hidden" name="answer_id" value={a.id} />
            <input name="note" placeholder="What to revise" class="flex-1 rounded-xl border px-2 py-1 text-sm" style="border-color:var(--line)" />
            <button class="text-sm" style="color:var(--warn)">Request revision</button>
          </form>
          <form method="POST" action="?/reject">
            <input type="hidden" name="answer_id" value={a.id} />
            <button class="text-sm" style="color:var(--neg)">Reject</button>
          </form>
        </div>
      </div>
    {/each}
  </div>
{/if}

<h2 class="mb-2 font-bold" style="color:var(--ink)">Your ideas</h2>
{#if data.ideas.length === 0}<p style="color:var(--muted)">No ideas yet.</p>{:else}
  <ul class="flex flex-col gap-2">
    {#each data.ideas as i (i.id)}<li><a href="/ideas/{i.id}" style="color:var(--green-deep)">{i.title}</a> <span style="color:var(--faint)">· {i.status}</span></li>{/each}
  </ul>
{/if}
