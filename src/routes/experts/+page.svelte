<script lang="ts">
  let { data } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Experts</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">Vetted researchers who post bounties on AI Safety Ideas.</p>
{#if data.experts.length === 0}
  <p style="color:var(--muted)">No experts yet.</p>
{:else}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.experts as e (e.id)}
      <a href="/u/{e.profile?.handle}" class="block rounded-2xl border p-5 transition" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-bold" style="color:var(--ink)">{e.profile?.display_name ?? e.profile?.handle ?? 'Expert'}</h2>
          {#if e.featured}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--green); color:var(--green-deep)">Featured</span>{/if}
        </div>
        {#if e.specialty}<p class="mt-1 text-sm" style="color:var(--muted)">{e.specialty}</p>{/if}
      </a>
    {/each}
  </div>
{/if}
