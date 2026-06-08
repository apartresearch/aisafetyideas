<script lang="ts">
  let { data } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Experts</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">Vetted researchers who post ideas on AI Safety Ideas.</p>
{#if data.experts.length === 0}
  <p style="color:var(--muted)">No experts yet.</p>
{:else}
  <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.experts as e (e.id)}
      <a href="/u/{e.profile?.handle}" class="card card-hover block p-5">
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-bold" style="color:var(--ink)">{e.profile?.display_name ?? e.profile?.handle ?? 'Expert'}</h2>
          <div class="flex flex-wrap gap-1.5 shrink-0">
            {#if e.featured}
              <span class="chip chip-open">Featured</span>
            {/if}
            <span class="chip" style="color:var(--green-deep);background:color-mix(in srgb,var(--green) 12%,transparent);border:1px solid color-mix(in srgb,var(--green) 30%,transparent)">
              <span aria-hidden="true">✓</span> Verified
            </span>
          </div>
        </div>
        {#if e.specialty}
          <p class="mt-2 text-sm" style="color:var(--muted)">{e.specialty}</p>
        {/if}
        {#if e.profile?.handle}
          <p class="mt-2 u-label">@{e.profile.handle}</p>
        {/if}
      </a>
    {/each}
  </div>
{/if}
