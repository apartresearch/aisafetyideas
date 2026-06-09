<script lang="ts">
  import Money from '$lib/components/Money.svelte';
  let { data } = $props();
  const stats: any = $derived(data.stats ?? {});
  const ideas = $derived(stats.ideas ?? {});
  const users = $derived(stats.users ?? {});
  const answers = $derived(stats.answers ?? {});
  const funding = $derived(stats.funding ?? {});

  const links = [
    { href: '/admin/ideas', label: 'Review queue' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/experts', label: 'Experts' },
    { href: '/admin/invites', label: 'Invites' },
    { href: '/admin/payouts', label: 'Payouts' }
  ];
</script>

<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Admin</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">Platform overview and moderation tools.</p>

<nav class="mb-8 flex flex-wrap gap-2">
  {#each links as l (l.href)}
    <a href={l.href} class="btn btn-secondary btn-sm">{l.label}</a>
  {/each}
</nav>

<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
  <section class="card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:16px">
    <h2 class="mb-3 text-xs uppercase" style="letter-spacing:.06em;color:var(--faint)">Ideas</h2>
    <p class="mb-2 text-3xl font-bold" style="color:var(--green-deep);font-variant-numeric:tabular-nums">{ideas.review_queue ?? 0}</p>
    <p class="mb-3 text-xs" style="color:var(--faint)">in review queue</p>
    <dl class="text-sm" style="color:var(--body)">
      <div class="flex justify-between"><dt>Open</dt><dd style="font-variant-numeric:tabular-nums">{ideas.open ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Draft</dt><dd style="font-variant-numeric:tabular-nums">{ideas.draft ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Resolved</dt><dd style="font-variant-numeric:tabular-nums">{ideas.resolved ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Closed</dt><dd style="font-variant-numeric:tabular-nums">{ideas.closed ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Archived</dt><dd style="font-variant-numeric:tabular-nums">{ideas.archived ?? 0}</dd></div>
    </dl>
  </section>

  <section class="card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:16px">
    <h2 class="mb-3 text-xs uppercase" style="letter-spacing:.06em;color:var(--faint)">Users</h2>
    <p class="mb-2 text-3xl font-bold" style="color:var(--ink);font-variant-numeric:tabular-nums">{users.total_profiles ?? 0}</p>
    <p class="mb-3 text-xs" style="color:var(--faint)">total profiles</p>
    <dl class="text-sm" style="color:var(--body)">
      <div class="flex justify-between"><dt>Experts approved</dt><dd style="font-variant-numeric:tabular-nums">{users.experts_approved ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Experts pending</dt><dd style="font-variant-numeric:tabular-nums">{users.experts_pending ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Admins</dt><dd style="font-variant-numeric:tabular-nums">{users.admins ?? 0}</dd></div>
    </dl>
  </section>

  <section class="card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:16px">
    <h2 class="mb-3 text-xs uppercase" style="letter-spacing:.06em;color:var(--faint)">Answers</h2>
    <p class="mb-2 text-3xl font-bold" style="color:var(--ink);font-variant-numeric:tabular-nums">{answers.total ?? 0}</p>
    <p class="mb-3 text-xs" style="color:var(--faint)">total answers</p>
    <dl class="text-sm" style="color:var(--body)">
      <div class="flex justify-between"><dt>Submitted</dt><dd style="font-variant-numeric:tabular-nums">{answers.submitted ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Under review</dt><dd style="font-variant-numeric:tabular-nums">{answers.under_review ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Verified</dt><dd style="font-variant-numeric:tabular-nums">{answers.verified ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Rejected</dt><dd style="font-variant-numeric:tabular-nums">{answers.rejected ?? 0}</dd></div>
      <div class="flex justify-between"><dt>Admin approved</dt><dd style="font-variant-numeric:tabular-nums">{answers.admin_approved ?? 0}</dd></div>
    </dl>
  </section>

  <section class="card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:16px">
    <h2 class="mb-3 text-xs uppercase" style="letter-spacing:.06em;color:var(--faint)">Funding</h2>
    <p class="mb-2 text-3xl font-bold" style="color:var(--green-deep)"><Money cents={funding.escrowed_cents ?? 0} /></p>
    <p class="mb-3 text-xs" style="color:var(--faint)">in escrow</p>
    <dl class="text-sm" style="color:var(--body)">
      <div class="flex justify-between"><dt>Pledged</dt><dd><Money cents={funding.pledged_cents ?? 0} /></dd></div>
      <div class="flex justify-between"><dt>Released</dt><dd><Money cents={funding.released_cents ?? 0} /></dd></div>
      <div class="flex justify-between"><dt>Refunded</dt><dd><Money cents={funding.refunded_cents ?? 0} /></dd></div>
      <div class="flex justify-between"><dt>Payable</dt><dd><Money cents={funding.payable_cents ?? 0} /></dd></div>
      <div class="flex justify-between"><dt>Treasury</dt><dd><Money cents={funding.platform_treasury_cents ?? 0} /></dd></div>
    </dl>
  </section>
</div>
