<script lang="ts">
  import Orb from '$lib/components/Orb.svelte';
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  let { data } = $props();
  const steps = [
    { n: '01', t: 'Experts post ideas', d: 'Vetted researchers publish concrete AI-safety questions and hypotheses worth investigating.' },
    { n: '02', t: 'Funders back them', d: 'Supporters pledge toward the ideas they want answered — building a transparent bounty.' },
    { n: '03', t: 'Researchers answer', d: 'Anyone can submit an answer with evidence and artifacts — code, papers, notebooks.' },
    { n: '04', t: 'Verified payouts', d: 'The author verifies a result and the payout is recorded — a clear path from question to impact.' }
  ];
</script>

<!-- Hero -->
<section class="relative -mx-6 -mt-6 overflow-hidden px-6 py-20"
         style="background-image: radial-gradient(var(--line) 1px, transparent 1px); background-size: 22px 22px;">
  <div class="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.4fr_1fr]">
    <div>
      <h1 class="text-4xl font-bold leading-tight md:text-5xl" style="color:var(--ink)">
        Fund the AI safety research that matters.
      </h1>
      <p class="mt-5 max-w-xl text-lg" style="font-family:var(--font-serif); color:var(--body)">
        Experts post research bounties, funders back them, and researchers submit answers. When an
        author verifies a result, the payout is recorded — a transparent path from open question to impact.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="/ideas" class="rounded-xl px-5 py-2.5 font-medium" style="background:var(--ink); color:#fff">Browse ideas</a>
        <a href={data.signedIn ? '/dashboard' : '/login'}
           class="rounded-xl border px-5 py-2.5 font-medium" style="border-color:var(--line-strong); color:var(--ink)">
          {data.signedIn ? 'Your dashboard' : 'Sign in'}
        </a>
      </div>
      {#if data.ideaCount > 0}
        <p class="mt-6 text-sm tabular-nums" style="color:var(--faint)">
          {data.ideaCount} open {data.ideaCount === 1 ? 'idea' : 'ideas'}{#if data.expertCount > 0} · {data.expertCount} {data.expertCount === 1 ? 'expert' : 'experts'}{/if}
        </p>
      {/if}
    </div>
    <div class="flex justify-center md:justify-end"><Orb size={210} /></div>
  </div>
</section>

<!-- How it works -->
<section class="mx-auto mt-16 max-w-5xl">
  <h2 class="mb-6 text-xs font-medium uppercase tracking-[.06em]" style="color:var(--faint)">How it works</h2>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each steps as s (s.n)}
      <div class="rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
        <span class="text-sm font-bold tabular-nums" style="color:var(--green-deep)">{s.n}</span>
        <h3 class="mt-2 font-bold" style="color:var(--ink)">{s.t}</h3>
        <p class="mt-1 text-sm" style="color:var(--muted)">{s.d}</p>
      </div>
    {/each}
  </div>
</section>

<!-- Recent bounties (degrades: hidden when empty) -->
{#if data.recent.length}
  <section class="mx-auto mt-16 max-w-5xl">
    <div class="mb-4 flex items-baseline justify-between">
      <h2 class="text-xl font-bold" style="color:var(--ink)">Recent bounties</h2>
      <a href="/ideas" style="color:var(--green-deep)">Browse all →</a>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.recent as idea (idea.id)}<IdeaCard {idea} />{/each}
    </div>
  </section>
{/if}

<!-- Closing CTA -->
<section class="mx-auto mt-16 max-w-5xl rounded-2xl border p-8 text-center"
         style="border-color:var(--line); background:var(--surface-2)">
  <h2 class="text-2xl font-bold" style="color:var(--ink)">Back the questions that move AI safety forward.</h2>
  <p class="mx-auto mt-2 max-w-xl" style="color:var(--muted)">
    Donations support a 501(c)(3) charitable mission; funds are recorded as intended payouts to the
    researchers whose answers are verified.
  </p>
  <div class="mt-5 flex justify-center gap-3">
    <a href="/ideas" class="rounded-xl px-5 py-2.5 font-medium" style="background:var(--ink); color:#fff">Explore the bounties</a>
    <a href="/experts" class="rounded-xl border px-5 py-2.5 font-medium" style="border-color:var(--line-strong); color:var(--ink)">Meet the experts</a>
  </div>
</section>
