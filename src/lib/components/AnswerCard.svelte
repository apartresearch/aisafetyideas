<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  import Money from './Money.svelte';
  import Markdown from './Markdown.svelte';
  type Artifact = { id: string; kind: string; url: string; label: string | null };
  let { answer }: {
    answer: {
      id: string; title: string; explanation_html?: string | null; status: string;
      payout_amount_cents: number | null; answer_artifacts?: Artifact[] | null;
      submitter?: { handle: string; display_name: string | null } | null;
    }
  } = $props();
</script>
<article class="rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-1 flex items-center justify-between gap-2">
    <h3 class="font-bold" style="color:var(--ink)">{answer.title}</h3>
    <StatusBadge status={answer.status} />
  </div>
  {#if answer.submitter}<p class="text-sm" style="color:var(--faint)">by {answer.submitter.display_name ?? answer.submitter.handle}</p>{/if}
  {#if answer.explanation_html}<Markdown html={answer.explanation_html} class="mt-2" />{/if}
  {#if answer.answer_artifacts?.length}
    <ul class="mt-3 flex flex-col gap-1 text-sm">
      {#each answer.answer_artifacts as a (a.id)}
        <li><a href={a.url} target="_blank" rel="noopener" style="color:var(--green-deep)">{a.label ?? a.kind} ↗</a></li>
      {/each}
    </ul>
  {/if}
  {#if answer.status === 'verified' && answer.payout_amount_cents != null}
    <p class="mt-3 text-sm" style="color:var(--muted)">Intended payout: <Money cents={answer.payout_amount_cents} /></p>
  {/if}
</article>
