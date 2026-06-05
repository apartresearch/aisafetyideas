<script lang="ts">
  let { data, form } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert console</h1>

<form method="POST" action="?/create" class="mb-8 flex flex-col gap-2 rounded-2xl border p-5"
      style="border-color:var(--line); background:var(--surface)">
  <h2 class="font-bold" style="color:var(--ink)">Post a new idea</h2>
  <input name="title" placeholder="Title" required class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <select name="type" class="rounded-xl border px-3 py-2" style="border-color:var(--line)">
    <option value="open_ended">Open-ended</option>
    <option value="hypothesis">Hypothesis (yes/no)</option>
  </select>
  <input name="claim" placeholder="Hypothesis claim (if hypothesis)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="summary_md" placeholder="Summary (markdown)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Publish</button>
  {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
</form>

<h2 class="mb-2 font-bold" style="color:var(--ink)">Your ideas</h2>
{#if data.ideas.length === 0}<p style="color:var(--muted)">No ideas yet.</p>{:else}
  <ul class="flex flex-col gap-2">
    {#each data.ideas as i (i.id)}<li><a href="/ideas/{i.id}" style="color:var(--green-deep)">{i.title}</a> <span style="color:var(--faint)">· {i.status}</span></li>{/each}
  </ul>
{/if}
