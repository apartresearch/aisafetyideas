<script lang="ts">
  import { enhance } from '$app/forms';

  let {
    open = $bindable(false),
    draft,
    form,
  }: {
    open: boolean;
    draft: { id: string; title: string; summary_md: string };
    form: { submitted?: boolean; id?: string; message?: string } | null;
  } = $props();

  // svelte-ignore state_referenced_locally
  let type = $state<'open_ended' | 'hypothesis'>('open_ended');
  // svelte-ignore state_referenced_locally
  let claim = $state('');
  // svelte-ignore state_referenced_locally
  let summaryMd = $state(draft.summary_md ?? '');
  let submitting = $state(false);

  function close() { open = false; }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="pd-backdrop"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="publish-dialog-title"
    onkeydown={handleKeydown}
  >
    <!-- Click-outside to close -->
    <div class="pd-overlay" role="presentation" onclick={close}></div>

    <div class="pd-panel card">
      <div class="pd-header">
        <h2 class="pd-title" id="publish-dialog-title">Publish idea</h2>
        <button class="pd-close" onclick={close} aria-label="Close">✕</button>
      </div>

      {#if form?.submitted && form?.id === draft.id}
        <div class="pd-submitted">
          <p class="pd-submitted__msg">Submitted for admin review.</p>
          <p class="pd-submitted__sub">You'll be notified when your idea goes live.</p>
          <button class="btn btn-primary btn-sm" onclick={close}>Done</button>
        </div>
      {:else}
        {#if form?.message}
          <p class="pd-error">{form.message}</p>
        {/if}

        <form
          method="POST"
          action="?/publish"
          use:enhance={() => {
            submitting = true;
            return async ({ update }) => {
              await update({ reset: false });
              submitting = false;
            };
          }}
          class="pd-form"
        >
          <input type="hidden" name="id" value={draft.id} />

          <div class="pd-field">
            <label class="u-label" for="pd-type">Type</label>
            <select
              id="pd-type"
              name="type"
              class="select"
              bind:value={type}
            >
              <option value="open_ended">Open-ended question</option>
              <option value="hypothesis">Hypothesis</option>
            </select>
          </div>

          {#if type === 'hypothesis'}
            <div class="pd-field">
              <label class="u-label" for="pd-claim">Hypothesis claim</label>
              <input
                id="pd-claim"
                name="claim"
                class="input"
                bind:value={claim}
                placeholder="State your hypothesis clearly…"
                required
              />
            </div>
          {/if}

          <div class="pd-field">
            <label class="u-label" for="pd-summary">Summary</label>
            <textarea
              id="pd-summary"
              name="summary_md"
              class="textarea"
              bind:value={summaryMd}
              rows={5}
              placeholder="Describe your idea for the public listing…"
            ></textarea>
          </div>

          <div class="pd-actions">
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              disabled={submitting}
            >
              {submitting ? 'Publishing…' : 'Publish idea'}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              onclick={close}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pd-backdrop {
    position: fixed; inset: 0; z-index: 200;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    animation: pd-fade-in var(--dur-base) var(--ease-snappy) both;
  }

  .pd-overlay {
    position: absolute; inset: 0;
    background: rgba(20, 24, 22, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .pd-panel {
    position: relative; z-index: 1;
    width: 100%; max-width: 480px;
    padding: 1.5rem;
    box-shadow: var(--shadow-pop);
    animation: pd-panel-in var(--dur-slow) var(--ease-emphasized) both;
  }

  .pd-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1.25rem;
  }
  .pd-title { font-size: 1.05rem; font-weight: 700; color: var(--ink); margin: 0; }

  .pd-close {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: .9rem; padding: .25rem .4rem;
    border-radius: var(--r-chip);
    transition: color var(--dur-fast) var(--ease-snappy),
                background var(--dur-fast) var(--ease-snappy);
  }
  .pd-close:hover { color: var(--ink); background: var(--surface-2); }

  .pd-form { display: flex; flex-direction: column; gap: 1rem; }

  .pd-field { display: flex; flex-direction: column; gap: .35rem; }

  .pd-actions {
    display: flex; align-items: center; gap: .6rem;
    padding-top: .25rem;
  }

  .pd-error {
    font-size: .85rem; color: var(--neg);
    margin-bottom: .75rem;
  }

  .pd-submitted {
    display: flex; flex-direction: column; gap: .6rem; padding: .5rem 0;
  }
  .pd-submitted__msg {
    font-weight: 600; color: var(--ink); font-size: 1rem; margin: 0;
  }
  .pd-submitted__sub {
    color: var(--muted); font-size: .875rem; margin: 0;
  }

  @keyframes pd-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pd-panel-in {
    from { opacity: 0; transform: scale(.96) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pd-backdrop, .pd-panel { animation: none !important; }
  }
</style>
