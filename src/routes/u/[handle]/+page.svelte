<script lang="ts">
  import Markdown from '$lib/components/Markdown.svelte';
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
<article class="rounded-2xl border p-6" style="border-color:var(--line);background:var(--surface);box-shadow:var(--shadow-1)">
  <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.profile.display_name ?? data.profile.handle}</h1>
  <p style="color:var(--faint)">@{data.profile.handle}{#if data.profile.career_stage} · {data.profile.career_stage}{/if}</p>
  <Markdown html={data.bio_html} class="mt-3" />

  {#if isSelf}
    <form method="POST" action="?/update" class="mt-6 flex flex-col gap-2">
      <input name="display_name" bind:value={displayName} placeholder="Display name"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <input name="career_stage" bind:value={careerStage} placeholder="Career stage"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <textarea name="bio_md" placeholder="Bio (markdown)" bind:value={bioMd}
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
      <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink);color:#fff">Save</button>
      {#if form?.saved}<span style="color:var(--green-deep)">Saved.</span>{/if}
      {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
    </form>
  {/if}
</article>
