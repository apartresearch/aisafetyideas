<script lang="ts">
  import { EXPANSIONS } from '$lib/lab/registry';
  import { buildAgentPrompt } from '$lib/lab/agent-prompt';
  import Spinner from '$lib/components/Spinner.svelte';
  import CritiqueRounds from './CritiqueRounds.svelte';

  let {
    draftId,
    title,
    notes_md,
    expansions = $bindable(),
  }: {
    draftId: string;
    title: string;
    notes_md: string;
    expansions: Record<string, any>;
  } = $props();

  // Per-expansion in-flight state
  let loading = $state<Record<string, boolean>>({});
  let errors = $state<Record<string, string>>({});
  // Clipboard feedback
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function runExpansion(key: string, kind: string, planKind?: string) {
    if (loading[key]) return;
    errors[key] = '';
    loading[key] = true;
    try {
      if (kind === 'client' && key === 'copy_agent') {
        const prompt = buildAgentPrompt({
          title,
          notes_md,
          execPlan: expansions.exec_plan_md?.md ?? null,
          readablePlan: expansions.readable_plan_md?.md ?? null,
        });
        try {
          await navigator.clipboard.writeText(prompt);
          // transient copied feedback
          if (copyTimer) clearTimeout(copyTimer);
          copied = true;
          copyTimer = setTimeout(() => { copied = false; }, 2000);
        } catch {
          errors['copy_agent'] = 'Clipboard unavailable';
        }
        return;
      }
      if (kind === 'review') {
        const res = await fetch(`/api/lab/${draftId}/review`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { errors[key] = data.message ?? 'Error'; return; }
        const prev = Array.isArray(expansions.critiques) ? expansions.critiques : [];
        expansions = { ...expansions, critiques: [...prev, data.round] };
        return;
      }
      if (kind === 'plan') {
        const pk = planKind === 'exec' ? 'exec' : 'readable';
        const res = await fetch(`/api/lab/${draftId}/plan`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: pk }),
        });
        const data = await res.json();
        if (!res.ok) { errors[key] = data.message ?? 'Error'; return; }
        const storeKey = pk === 'exec' ? 'exec_plan_md' : 'readable_plan_md';
        expansions = { ...expansions, [storeKey]: { md: data.md, at: new Date().toISOString() } };
        return;
      }
    } finally {
      loading[key] = false;
    }
  }

  const critiques = $derived(Array.isArray(expansions.critiques) ? expansions.critiques : []);
  const execPlan = $derived(expansions.exec_plan_md?.md ?? null);
  const readablePlan = $derived(expansions.readable_plan_md?.md ?? null);
</script>

<div class="exp-panel">
  <p class="u-label exp-panel__label">Expansion tools</p>
  <div class="exp-panel__grid">
    {#each EXPANSIONS as exp (exp.key)}
      {#if exp.status === 'soon'}
        <span class="chip chip-muted exp-btn exp-btn--soon" title="Coming soon">
          <span class="exp-btn__icon" aria-hidden="true">{exp.icon}</span>
          {exp.label}
          <span class="exp-btn__soon">Soon</span>
        </span>
      {:else}
        <button
          class="chip chip-line exp-btn"
          class:exp-btn--loading={loading[exp.key]}
          disabled={loading[exp.key]}
          onclick={() => runExpansion(exp.key, exp.kind, exp.planKind)}
          title={exp.label}
        >
          {#if loading[exp.key]}
            <Spinner size={13} label={exp.label} />
          {:else}
            <span class="exp-btn__icon" aria-hidden="true">{exp.icon}</span>
          {/if}
          {#if exp.key === 'copy_agent' && copied}Copied{:else}{exp.label}{/if}
        </button>
      {/if}
    {/each}
  </div>

  <!-- Per-expansion errors -->
  {#each EXPANSIONS as exp (exp.key)}
    {#if errors[exp.key]}
      <p class="exp-error">{errors[exp.key]}</p>
    {/if}
  {/each}

  <!-- Critique rounds output -->
  {#if critiques.length > 0}
    <CritiqueRounds rounds={critiques} />
  {/if}

  <!-- Plan outputs (raw markdown from AI — rendered as preformatted text; no HTML injection) -->
  {#if execPlan}
    <div class="exp-plan">
      <p class="u-label exp-plan__label">ExecPlan</p>
      <pre class="exp-plan__pre">{execPlan}</pre>
    </div>
  {/if}
  {#if readablePlan}
    <div class="exp-plan">
      <p class="u-label exp-plan__label">Readable plan</p>
      <pre class="exp-plan__pre">{readablePlan}</pre>
    </div>
  {/if}
</div>

<style>
  .exp-panel { margin-top: 1rem; }
  .exp-panel__label { margin-bottom: .6rem; }

  .exp-panel__grid {
    display: flex; flex-wrap: wrap; gap: .4rem;
  }

  .exp-btn {
    cursor: pointer; font-size: .75rem; font-family: inherit;
    transition: background var(--dur-fast) var(--ease-snappy),
                border-color var(--dur-fast) var(--ease-snappy),
                color var(--dur-fast);
    user-select: none;
  }
  .exp-btn:not(.exp-btn--soon):not(:disabled):hover {
    background: var(--surface-2); border-color: var(--ink); color: var(--ink);
  }
  .exp-btn:disabled { opacity: .55; cursor: default; }
  .exp-btn--soon { cursor: default; }

  .exp-btn__icon { font-size: .85em; }
  .exp-btn__soon {
    font-size: .65rem; text-transform: uppercase; letter-spacing: .06em;
    color: var(--faint); margin-left: .2rem;
  }

  .exp-error {
    margin-top: .5rem; font-size: .82rem; color: var(--neg);
  }

  .exp-plan { margin-top: 1rem; }
  .exp-plan__label { margin-bottom: .4rem; }
  .exp-plan__pre {
    font-family: 'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace;
    font-size: .82rem; line-height: 1.6; color: var(--body);
    background: var(--surface-2); border: 1px solid var(--line);
    border-radius: var(--r-ctrl); padding: .75rem 1rem;
    white-space: pre-wrap; word-break: break-word; overflow-x: auto;
  }
</style>
