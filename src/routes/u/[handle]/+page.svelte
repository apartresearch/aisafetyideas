<script lang="ts">
  let { data, form } = $props();
  let isSelf = $derived(data.user?.id === data.profile.id);
</script>
<article class="rounded-2xl border p-6" style="border-color:var(--line);background:var(--surface);box-shadow:var(--shadow-1)">
  <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.profile.display_name ?? data.profile.handle}</h1>
  <p style="color:var(--faint)">@{data.profile.handle}{#if data.profile.career_stage} · {data.profile.career_stage}{/if}</p>
  <p class="mt-3" style="color:var(--body)">{data.profile.bio_md ?? ''}</p>

  {#if isSelf}
    <form method="POST" action="?/update" class="mt-6 flex flex-col gap-2">
      <input name="display_name" value={data.profile.display_name ?? ''} placeholder="Display name"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <input name="career_stage" value={data.profile.career_stage ?? ''} placeholder="Career stage"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <textarea name="bio_md" placeholder="Bio (markdown)"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)">{data.profile.bio_md ?? ''}</textarea>
      <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink);color:#fff">Save</button>
      {#if form?.saved}<span style="color:var(--green-deep)">Saved.</span>{/if}
      {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
    </form>
  {/if}
</article>
