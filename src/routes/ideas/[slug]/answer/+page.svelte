<script lang="ts">
  let { data, form }: { data: any; form: any } = $props();
  // Local state + bind:value so a background re-render (e.g. the layout's onAuthStateChange
  // invalidate, or a validation-error reload) never clobbers in-progress input. Seeded from `form`
  // so a failed submit still repopulates.
  // svelte-ignore state_referenced_locally
  let title = $state(form?.title ?? '');
  // svelte-ignore state_referenced_locally
  let explanation_md = $state(form?.explanation_md ?? '');
  let artifacts = $state('');
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Submit an answer</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">for <a href="/ideas/{data.idea.slug}" style="color:var(--green-deep)">{data.idea.title}</a></p>
<form method="POST" class="flex flex-col gap-3 rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface)">
  <input name="title" placeholder="Answer title" required bind:value={title}
         class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="explanation_md" placeholder="Explain your answer (markdown)" rows="6" bind:value={explanation_md}
            class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <textarea name="artifacts" placeholder="Artifact links — one per line (GitHub, PDF, Colab, URL)" rows="3" bind:value={artifacts}
            class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Submit</button>
  {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
</form>
