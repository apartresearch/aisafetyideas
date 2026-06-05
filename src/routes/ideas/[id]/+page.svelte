<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import AnswerCard from '$lib/components/AnswerCard.svelte';
  import BountyMeter from '$lib/components/BountyMeter.svelte';
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
</script>
<div class="grid gap-6 lg:grid-cols-[1fr_280px]">
  <div>
    <article class="rounded-2xl border p-6" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{data.idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
        <StatusBadge status={data.idea.status} />
      </div>
      <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.idea.title}</h1>
      {#if data.author}<p class="text-sm" style="color:var(--faint)">by <a href="/u/{data.author.handle}" style="color:var(--green-deep)">{data.author.display_name ?? data.author.handle}</a></p>{/if}
      {#if data.idea.claim}<p class="mt-3 italic" style="color:var(--body)">{data.idea.claim}</p>{/if}
      {#if data.idea.summary_md}<p class="mt-3 whitespace-pre-wrap" style="color:var(--body)">{data.idea.summary_md}</p>{/if}
      {#if data.categories.length}<div class="mt-4 flex flex-wrap gap-2">{#each data.categories as c}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--line); color:var(--muted)">{c.title}</span>{/each}</div>{/if}
      {#if data.idea.source_url}<p class="mt-4 text-sm"><a href={data.idea.source_url} target="_blank" rel="noopener" style="color:var(--green-deep)">Source ↗</a></p>{/if}
    </article>

    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xl font-bold" style="color:var(--ink)">Answers</h2>
        {#if data.canSubmit}
          <a href="/ideas/{data.idea.id}/answer" class="rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Submit an answer</a>
        {/if}
      </div>
      {#if data.answers.length === 0}
        <p style="color:var(--muted)">No answers yet.</p>
      {:else}
        <div class="flex flex-col gap-3">
          {#each data.answers as answer (answer.id)}<AnswerCard {answer} />{/each}
        </div>
      {/if}
    </section>
  </div>

  <aside class="flex flex-col gap-4">
    <BountyMeter potCents={data.pot.pot_cents} funderCount={data.pot.funder_count} currency={data.idea.currency ?? 'USD'} />

    {#if data.canFund}
      <form method="POST" action="?/pledge" class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <label class="text-xs uppercase tracking-wide" style="color:var(--faint)">Fund this idea ($)
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required
                 class="mt-1 block w-full rounded-xl border px-3 py-2" style="border-color:var(--line)" />
        </label>
        <button class="mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Pledge</button>
        <p class="mt-2 text-xs" style="color:var(--faint)">A pledge is a commitment — no funds move yet.</p>
        {#if form?.message}<p class="mt-2 text-sm" style="color:var(--neg)">{form.message}</p>{/if}
      </form>
    {/if}

    {#if data.funders.length}
      <div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <p class="mb-2 text-xs uppercase tracking-wide" style="color:var(--faint)">Funders</p>
        <ul class="flex flex-col gap-1 text-sm">
          {#each data.funders as f (f.key)}
            <li class="flex justify-between gap-2">
              <span style="color:var(--body)">{f.name}</span>
              <span class="tabular-nums" style="color:var(--ink)"><Money cents={f.amount_cents} currency={f.currency} /></span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </aside>
</div>
