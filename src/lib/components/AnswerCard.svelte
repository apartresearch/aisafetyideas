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
<article class="card answer">
  <div class="answer__head">
    <h3 class="answer__title">{answer.title}</h3>
    <StatusBadge status={answer.status} />
  </div>
  {#if answer.submitter}<p class="answer__by">by {answer.submitter.display_name ?? answer.submitter.handle}</p>{/if}
  {#if answer.explanation_html}<Markdown html={answer.explanation_html} class="answer__body" />{/if}
  {#if answer.answer_artifacts?.length}
    <ul class="answer__artifacts">
      {#each answer.answer_artifacts as a (a.id)}
        <li><a href={a.url} target="_blank" rel="noopener">{a.label ?? a.kind}&nbsp;↗</a></li>
      {/each}
    </ul>
  {/if}
  {#if answer.status === 'verified' && answer.payout_amount_cents != null}
    <p class="answer__payout">
      <span class="u-label">Intended payout</span>
      <span class="answer__payout-amt tnum"><Money cents={answer.payout_amount_cents} /></span>
    </p>
  {/if}
</article>
<style>
  .answer { padding: 1.25rem 1.35rem; }
  .answer__head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .answer__title { font-size: 1.05rem; font-weight: 700; color: var(--ink); line-height: 1.3; }
  .answer__by { margin-top: .25rem; font-size: .82rem; color: var(--faint); }
  :global(.answer__body) { margin-top: .7rem; }
  .answer__artifacts { margin-top: .85rem; display: flex; flex-direction: column; gap: .3rem; font-size: .88rem; }
  .answer__artifacts a { color: var(--green-deep); }
  .answer__artifacts a:hover { text-decoration: underline; text-underline-offset: 2px; }
  .answer__payout {
    margin-top: 1rem; padding-top: .85rem; border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; gap: .75rem;
  }
  .answer__payout-amt { font-weight: 700; color: var(--green-deep); }
</style>
