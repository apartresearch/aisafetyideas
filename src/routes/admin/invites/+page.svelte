<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let copied = $state<string | null>(null);

  async function copy(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    copied = id;
    setTimeout(() => { copied = null; }, 2000);
  }

  function formatDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function isExpired(iso: string | null) {
    return iso ? new Date(iso) < new Date() : false;
  }
</script>

<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Expert invite links</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">
  Each link grants the recipient instant approved-expert status when they visit it while logged in.
</p>

{#if form?.message}
  <p class="mb-4 text-sm" style="color:var(--neg)">{form.message}</p>
{/if}

<!-- Create form -->
<section class="mb-8 rounded-[var(--r-card)] border p-5" style="border-color:var(--line-strong);background:var(--surface)">
  <h2 class="mb-4 text-sm font-semibold uppercase tracking-[.06em]" style="color:var(--faint)">Create invite</h2>
  <form method="POST" action="?/create" use:enhance class="flex flex-wrap gap-3 items-end">
    <label class="flex flex-col gap-1 text-xs" style="color:var(--muted)">
      <span class="uppercase tracking-[.06em]" style="color:var(--faint)">Specialty (optional)</span>
      <input name="specialty" type="text" placeholder="e.g. Alignment theory"
        class="rounded-[var(--r-ctrl)] border px-3 py-2 text-sm"
        style="border-color:var(--line-strong);background:var(--surface-2);color:var(--ink)" />
    </label>
    <label class="flex flex-col gap-1 text-xs" style="color:var(--muted)">
      <span class="uppercase tracking-[.06em]" style="color:var(--faint)">Max uses</span>
      <input name="max_uses" type="number" min="1" value="1"
        class="w-24 rounded-[var(--r-ctrl)] border px-3 py-2 text-sm"
        style="border-color:var(--line-strong);background:var(--surface-2);color:var(--ink)" />
    </label>
    <label class="flex flex-col gap-1 text-xs" style="color:var(--muted)">
      <span class="uppercase tracking-[.06em]" style="color:var(--faint)">Expires (optional)</span>
      <input name="expires_at" type="date"
        class="rounded-[var(--r-ctrl)] border px-3 py-2 text-sm"
        style="border-color:var(--line-strong);background:var(--surface-2);color:var(--ink)" />
    </label>
    <button type="submit"
      class="rounded-[var(--r-pill)] px-5 py-2 text-sm font-medium transition-transform active:scale-[.97]"
      style="background:var(--ink);color:#fff;transition-duration:var(--dur-fast)">
      Generate link
    </button>
  </form>
</section>

<!-- Invites list -->
{#if data.invites.length === 0}
  <p style="color:var(--muted)">No invite links yet.</p>
{:else}
  <table class="w-full text-sm">
    <thead>
      <tr class="uppercase tracking-[.06em] text-xs" style="color:var(--faint)">
        <th class="pb-2 text-left">Link</th>
        <th class="pb-2 text-left">Specialty</th>
        <th class="pb-2 text-right">Uses</th>
        <th class="pb-2 text-left pl-4">Expires</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.invites as inv (inv.id)}
        {@const expired = isExpired(inv.expires_at)}
        {@const exhausted = inv.used_count >= inv.max_uses}
        <tr style="border-top:1px solid var(--line)" class:opacity-50={expired || exhausted}>
          <td class="py-2 pr-3 font-mono text-xs max-w-[260px] truncate" style="color:var(--body)">
            {inv.invite_url}
          </td>
          <td class="py-2 pr-3" style="color:var(--muted)">{inv.specialty ?? '-'}</td>
          <td class="py-2 text-right tabular-nums" style="color:{exhausted ? 'var(--neg)' : 'var(--ink)'}">
            {inv.used_count}/{inv.max_uses}
          </td>
          <td class="py-2 pl-4" style="color:{expired ? 'var(--neg)' : 'var(--muted)'}">
            {formatDate(inv.expires_at)}
          </td>
          <td class="py-2 text-right whitespace-nowrap">
            <button
              type="button"
              onclick={() => copy(inv.invite_url, inv.id)}
              class="mr-3 text-xs transition-colors"
              style="color:{copied === inv.id ? 'var(--green-deep)' : 'var(--muted)'}">
              {copied === inv.id ? 'Copied!' : 'Copy'}
            </button>
            <form method="POST" action="?/revoke" use:enhance class="inline">
              <input type="hidden" name="id" value={inv.id} />
              <button type="submit" class="text-xs" style="color:var(--neg)">Delete</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
