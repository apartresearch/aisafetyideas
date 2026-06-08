<script lang="ts">
  import DraftCapture from './DraftCapture.svelte';
  import DraftCard from './DraftCard.svelte';

  let {
    store,
  }: {
    store: { drafts: any[]; add: (title: string) => Promise<void>; remove: (id: string) => void };
  } = $props();
</script>

<div class="draft-list">
  <DraftCapture {store} />

  {#if store.drafts.length === 0}
    <p class="draft-list__empty">Capture your first idea — type a line and hit Enter.</p>
  {:else}
    <ul class="draft-list__items">
      {#each store.drafts as draft, i (draft.id)}
        <li>
          <DraftCard bind:draft={store.drafts[i]} onremove={store.remove} />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .draft-list { display: flex; flex-direction: column; gap: .75rem; }

  .draft-list__empty {
    text-align: center; padding: 2.5rem 1rem; color: var(--muted); font-size: .95rem;
  }

  .draft-list__items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .6rem; }
</style>
