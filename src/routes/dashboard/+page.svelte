<script lang="ts">
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import Money from '$lib/components/Money.svelte';
  import DraftList from '$lib/components/lab/DraftList.svelte';
  import { createDraftsStore } from '$lib/lab/draftsStore.svelte';

  let { data, form } = $props();
  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  // svelte-ignore state_referenced_locally
  const draftsStore = createDraftsStore(data.drafts);

  // ── Payouts panel state ──
  let payoutBusy = $state(false);
  let payoutMsg = $state('');
  let withdrawAmount = $state('');

  async function onboard() {
    payoutBusy = true;
    payoutMsg = '';
    try {
      const res = await fetch('/api/connect/onboard', { method: 'POST' });
      const body = await res.json();
      if (res.ok && body.url) window.location.href = body.url;
      else payoutMsg = body.message ?? 'Could not start onboarding';
    } catch {
      payoutMsg = 'Could not start onboarding';
    } finally {
      payoutBusy = false;
    }
  }

  async function withdraw(e: SubmitEvent) {
    e.preventDefault();
    payoutBusy = true;
    payoutMsg = '';
    const dollars = Number(withdrawAmount);
    const amount_cents = Math.round(dollars * 100);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount_cents, nonce: crypto.randomUUID() })
      });
      const body = await res.json();
      if (res.ok) {
        payoutMsg = 'Withdrawal sent — your balance will update shortly.';
        withdrawAmount = '';
      } else {
        payoutMsg = body.message ?? 'Withdrawal failed';
      }
    } catch {
      payoutMsg = 'Withdrawal failed';
    } finally {
      payoutBusy = false;
    }
  }
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Dashboard</h1>
{#if form?.message}<p class="mb-3 text-sm" style="color:var(--neg)">{form.message}</p>{/if}

<nav class="mb-6 flex gap-2 text-sm">
  <a href="/dashboard" style="color:{data.tab === 'feed' ? 'var(--green-deep)' : 'var(--muted)'}">Feed</a>
  <a href="/dashboard?tab=discover" style="color:{data.tab === 'discover' ? 'var(--green-deep)' : 'var(--muted)'}">Discover</a>
  <a href="/dashboard?tab=lab" style="color:{data.tab === 'lab' ? 'var(--green-deep)' : 'var(--muted)'}">Lab</a>
</nav>

{#if data.tab === 'lab'}
  <DraftList store={draftsStore} {form} />
{:else}
  {#if data.tab === 'discover' || !data.hasFollows}
    {#if !data.hasFollows && data.tab === 'feed'}
      <p class="mb-4" style="color:var(--muted)">Follow experts to build your feed of new bounties.</p>
    {/if}
    <div class="mb-8 grid gap-3 sm:grid-cols-2">
      {#each data.experts as e (e.id)}
        <div class="flex items-center justify-between gap-3 rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
          <div>
            <a href="/u/{e.profile?.handle}" class="font-medium" style="color:var(--ink)">{e.profile?.display_name ?? e.profile?.handle ?? 'Expert'}</a>
            {#if e.specialty}<p class="text-xs" style="color:var(--faint)">{e.specialty}</p>{/if}
          </div>
          <form method="POST" action={e.following ? '?/unfollow' : '?/follow'}>
            <input type="hidden" name="expert_id" value={e.id} />
            <button class="rounded-xl px-3 py-1 text-sm font-medium"
                    style={e.following ? 'border:1px solid var(--line); color:var(--muted)' : 'background:var(--ink); color:#fff'}>
              {e.following ? 'Following' : 'Follow'}
            </button>
          </form>
        </div>
      {/each}
    </div>
  {:else}
    <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.feed as idea (idea.id)}<IdeaCard {idea} />{/each}
    </div>
    {#if data.feed.length === 0}<p class="mb-8" style="color:var(--muted)">No new open bounties from the experts you follow.</p>{/if}
  {/if}

  <h2 class="mb-3 text-xl font-bold" style="color:var(--ink)">My funding</h2>
  {#if data.myPledges.length === 0}
    <p style="color:var(--muted)">You haven't pledged to any ideas yet.</p>
  {:else}
    <p class="mb-3 text-sm" style="color:var(--muted)">Total committed <span class="text-base font-bold" style="color:var(--ink)"><Money cents={data.totalCommittedCents} /></span> <span style="color:var(--faint)">· no funds moved yet</span></p>
    <div class="mb-4 rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
      <BarChart series={data.chart} format={money} />
    </div>
    <ul class="flex flex-col gap-2">
      {#each data.myPledges as p (p.id)}
        <li class="flex items-center justify-between gap-3 rounded-xl border p-3" style="border-color:var(--line); background:var(--surface)">
          <a href="/ideas/{p.idea?.slug ?? p.idea_id}" style="color:var(--green-deep)">{p.idea?.title ?? 'Idea'}</a>
          <span class="flex items-center gap-3">
            <span class="tabular-nums" style="color:var(--ink)"><Money cents={p.amount_cents} currency={p.currency} /></span>
            <span class="text-xs" style="color:var(--faint)">{p.status}</span>
            {#if p.status === 'committed'}
              <form method="POST" action="?/withdraw">
                <input type="hidden" name="pledge_id" value={p.id} />
                <button class="text-xs" style="color:var(--neg)">Withdraw</button>
              </form>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 class="mb-3 mt-8 text-xl font-bold" style="color:var(--ink)">Payouts</h2>
  <div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
    <div class="mb-4 grid gap-3 sm:grid-cols-3">
      <div>
        <p class="text-xs uppercase tracking-wide" style="color:var(--faint); letter-spacing:.06em">Payable</p>
        <p class="text-lg font-bold" style="color:var(--ink)"><Money cents={data.balances.payableCents} /></p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide" style="color:var(--faint); letter-spacing:.06em">Available</p>
        <p class="text-lg font-bold" style="color:var(--ink)"><Money cents={data.balances.availableCents} /></p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide" style="color:var(--faint); letter-spacing:.06em">Escrowed</p>
        <p class="text-lg font-bold" style="color:var(--ink)"><Money cents={data.balances.escrowedCents} /></p>
      </div>
    </div>

    {#if payoutMsg}<p class="mb-3 text-sm" style="color:var(--muted)">{payoutMsg}</p>{/if}

    {#if data.payoutsEnabled}
      <form class="flex flex-wrap items-end gap-2" onsubmit={withdraw}>
        <label class="flex flex-col text-xs" style="color:var(--faint)">
          Amount (USD)
          <input
            type="number" min="1" step="0.01" inputmode="decimal" required
            bind:value={withdrawAmount} placeholder="0.00"
            class="mt-1 w-32 rounded-xl border px-3 py-2 tabular-nums"
            style="border-color:var(--line); color:var(--ink)" />
        </label>
        <button
          type="submit" disabled={payoutBusy}
          class="rounded-xl px-4 py-2 text-sm font-medium"
          style="background:var(--ink); color:#fff; opacity:{payoutBusy ? 0.6 : 1}">
          {payoutBusy ? 'Working…' : 'Withdraw'}
        </button>
      </form>
    {:else}
      <p class="mb-3 text-sm" style="color:var(--muted)">Connect a payout account to withdraw your payable balance.</p>
      <button
        type="button" onclick={onboard} disabled={payoutBusy}
        class="rounded-xl px-4 py-2 text-sm font-medium"
        style="background:var(--ink); color:#fff; opacity:{payoutBusy ? 0.6 : 1}">
        {payoutBusy ? 'Working…' : 'Onboard to receive payouts'}
      </button>
    {/if}
  </div>
{/if}
