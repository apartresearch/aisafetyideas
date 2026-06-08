<script lang="ts">
  import Markdown from '$lib/components/Markdown.svelte';
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
  let isSelf = $derived(data.user?.id === data.profile.id);
  // Local state + bind:value so a background re-render mid-edit can't reset the fields (seeded from
  // the persisted profile).
  // svelte-ignore state_referenced_locally
  let displayName = $state(data.profile.display_name ?? '');
  // svelte-ignore state_referenced_locally
  let careerStage = $state(data.profile.career_stage ?? '');
  // svelte-ignore state_referenced_locally
  let bioMd = $state(data.profile.bio_md ?? '');
</script>
<article class="card" style="padding:1.5rem">
  <div class="flex flex-wrap items-start gap-3">
    <div class="flex-1 min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.profile.display_name ?? data.profile.handle}</h1>
        {#if data.isVerifiedExpert}
          <span class="chip" style="color:var(--green-deep);background:color-mix(in srgb,var(--green) 12%,transparent);border:1px solid color-mix(in srgb,var(--green) 30%,transparent)">
            <span aria-hidden="true">✓</span> Verified expert
          </span>
        {/if}
      </div>
      <p class="mt-0.5" style="color:var(--faint)">@{data.profile.handle}{#if data.profile.career_stage} · {data.profile.career_stage}{/if}</p>
    </div>
  </div>
  <Markdown html={data.bio_html} class="mt-3" />

  {#if data.earnings.lifetime_cents > 0}
    <div class="mt-4 flex flex-wrap gap-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider" style="color:var(--faint);letter-spacing:.06em">Lifetime earnings</p>
        <p class="mt-0.5 text-lg font-bold" style="color:var(--ink);font-variant-numeric:tabular-nums">
          <Money cents={data.earnings.lifetime_cents} />
        </p>
      </div>
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider" style="color:var(--faint);letter-spacing:.06em">Verified answers</p>
        <p class="mt-0.5 text-lg font-bold" style="color:var(--ink);font-variant-numeric:tabular-nums">{data.earnings.payout_count}</p>
      </div>
    </div>
  {/if}

  {#if isSelf}
    <form method="POST" action="?/update" class="mt-6 flex flex-col gap-2">
      <input name="display_name" bind:value={displayName} placeholder="Display name"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <input name="career_stage" bind:value={careerStage} placeholder="Career stage"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <textarea name="bio_md" placeholder="Bio (markdown)" bind:value={bioMd}
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
      <button class="self-start btn btn-primary btn-sm">Save</button>
      {#if form?.saved}<span style="color:var(--green-deep)">Saved.</span>{/if}
      {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
    </form>
  {/if}
</article>

{#if data.authored.length > 0}
  <section class="mt-8">
    <h2 class="mb-4 text-lg font-bold" style="color:var(--ink)">
      Ideas by {data.profile.display_name ?? data.profile.handle}
    </h2>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.authored as idea (idea.id)}
        <IdeaCard {idea} />
      {/each}
    </div>
  </section>
{/if}
