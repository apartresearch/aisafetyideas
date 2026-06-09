<script lang="ts">
  import ExpansionPanel from './ExpansionPanel.svelte';
  import PublishDialog from './PublishDialog.svelte';
  import type { DraftRow } from '$lib/lab/draftsStore.svelte';

  let {
    draft = $bindable(),
    onremove,
    form = null,
    isExpert = false,
  }: {
    draft: DraftRow;
    onremove: (id: string) => void;
    form?: { submitted?: boolean; message?: string } | null;
    isExpert?: boolean;
  } = $props();

  // Approved experts publish straight to live; everyone else submits for admin review.
  let publishLabel = $derived(isExpert ? 'Publish' : 'Submit for review');

  let expanded = $state(false);
  let publishOpen = $state(false);

  // Local editable copies seeded from prop - svelte-ignore state_referenced_locally
  // svelte-ignore state_referenced_locally
  let localTitle = $state(draft.title);
  // svelte-ignore state_referenced_locally
  let localNotes = $state(draft.summary_md ?? '');

  let titleTimer: ReturnType<typeof setTimeout> | null = null;
  let notesTimer: ReturnType<typeof setTimeout> | null = null;

  function saveTitle(val: string) {
    draft.title = val;
    if (titleTimer) clearTimeout(titleTimer);
    if (draft.id.startsWith('tmp-')) return;
    titleTimer = setTimeout(() => {
      fetch(`/api/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: val }),
      });
    }, 600);
  }

  function saveNotes(val: string) {
    draft.summary_md = val;
    if (notesTimer) clearTimeout(notesTimer);
    if (draft.id.startsWith('tmp-')) return;
    notesTimer = setTimeout(() => {
      fetch(`/api/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes_md: val }),
      });
    }, 600);
  }

  function toggle() { expanded = !expanded; }
</script>

<article class="draft-card card card-hover" class:draft-card--expanded={expanded}>
  <!-- Collapsed header - click anywhere on header row to expand -->
  <div class="draft-card__header" role="button" tabindex="0"
       onclick={toggle} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
    <span class="draft-card__title-text" title={draft.title}>
      {draft.title || 'Untitled idea'}
    </span>
    <span class="draft-card__meta">
      {#if draft.pending}
        <span class="chip chip-muted">Saving…</span>
      {:else if draft.errored}
        <span class="chip" style="color:var(--neg); background:color-mix(in srgb,var(--neg) 10%,transparent); border:1px solid color-mix(in srgb,var(--neg) 20%,transparent)">Error</span>
      {/if}
      <span class="draft-card__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
    </span>
  </div>

  <!-- Expanded body -->
  {#if expanded}
    <div class="draft-card__body">
      <div class="draft-card__field">
        <label class="u-label draft-card__field-label" for="draft-title-{draft.id}">Title</label>
        <input
          id="draft-title-{draft.id}"
          class="input"
          value={localTitle}
          oninput={(e) => { localTitle = (e.currentTarget as HTMLInputElement).value; saveTitle(localTitle); }}
          placeholder="Idea title"
        />
      </div>

      <div class="draft-card__field">
        <label class="u-label draft-card__field-label" for="draft-notes-{draft.id}">Notes</label>
        <textarea
          id="draft-notes-{draft.id}"
          class="textarea"
          value={localNotes}
          oninput={(e) => { localNotes = (e.currentTarget as HTMLTextAreaElement).value; saveNotes(localNotes); }}
          placeholder="Describe your idea, hypotheses, context…"
          rows={5}
        ></textarea>
        <p style="font-size:.75rem; color:var(--faint); margin:0">Markdown + LaTeX ($x^2$, $$\sum$$) supported</p>
      </div>

      <ExpansionPanel
        draftId={draft.id}
        title={draft.title}
        notes_md={draft.summary_md ?? ''}
        bind:expansions={draft.expansions}
      />

      <div class="draft-card__actions">
        <button
          class="btn btn-primary btn-sm"
          disabled={draft.pending || draft.id.startsWith('tmp-')}
          onclick={() => { publishOpen = true; }}
          title={isExpert ? 'Publish this draft as a public idea' : 'Submit this draft for admin review'}
        >
          {publishLabel}
        </button>
        <button
          class="btn btn-ghost btn-sm draft-card__delete"
          onclick={() => onremove(draft.id)}
          title="Delete draft"
        >
          Delete
        </button>
      </div>
    </div>
  {/if}
</article>

<PublishDialog
  bind:open={publishOpen}
  draft={{ id: draft.id, title: draft.title, summary_md: draft.summary_md ?? '' }}
  {form}
  {isExpert}
/>

<style>
  .draft-card { padding: 0; overflow: hidden; }
  .draft-card--expanded { box-shadow: var(--shadow-2); }

  .draft-card__header {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: .85rem 1rem; cursor: pointer; user-select: none;
    transition: background var(--dur-fast) var(--ease-snappy);
  }
  .draft-card__header:hover { background: var(--surface-2); }

  .draft-card__title-text {
    flex: 1; font-weight: 600; font-size: .95rem; color: var(--ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .draft-card__meta { display: flex; align-items: center; gap: .5rem; flex: none; }
  .draft-card__chevron { color: var(--faint); font-size: .7rem; }

  .draft-card__body {
    padding: 0 1rem 1rem; border-top: 1px solid var(--line);
    display: flex; flex-direction: column; gap: .8rem;
  }

  .draft-card__field { display: flex; flex-direction: column; gap: .35rem; padding-top: .8rem; }
  .draft-card__field:first-child { padding-top: .9rem; }
  .draft-card__field-label { display: block; }

  .draft-card__actions {
    display: flex; align-items: center; gap: .6rem; padding-top: .4rem;
  }

  .draft-card__delete { color: var(--neg); }
  .draft-card__delete:hover { color: var(--neg); background: color-mix(in srgb, var(--neg) 8%, transparent); }
</style>
