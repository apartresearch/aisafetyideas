<script lang="ts">
  let { data, form }: { data: any; form: any } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Submit an answer</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">for <a href="/ideas/{data.idea.id}" style="color:var(--green-deep)">{data.idea.title}</a></p>
<form method="POST" class="flex flex-col gap-3 rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface)">
  <input name="title" placeholder="Answer title" required value={form?.title ?? ''}
         class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="explanation_md" placeholder="Explain your answer (markdown)" rows="6"
            class="rounded-xl border px-3 py-2" style="border-color:var(--line)">{form?.explanation_md ?? ''}</textarea>
  <textarea name="artifacts" placeholder="Artifact links — one per line (GitHub, PDF, Colab, URL)" rows="3"
            class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Submit</button>
  {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
</form>
