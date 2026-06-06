<script lang="ts">
  import { enhance } from '$app/forms';
  let { score, myVote, canVote, signinHref }: {
    score: number; myVote: 1 | -1 | null; canVote: boolean; signinHref?: string;
  } = $props();

  // Optimistic local view (spec §6): apply the expected outcome immediately, reconcile when the
  // action's load re-run delivers fresh props (the $effect clears the override on every prop change).
  let pending = $state(false);
  let optimistic = $state<{ score: number; myVote: 1 | -1 | null } | null>(null);
  $effect(() => { void score; void myVote; optimistic = null; });
  const view = $derived(optimistic ?? { score, myVote });

  const submit = (value: 1 | -1) => () => {
    const cur = view;
    optimistic = cur.myVote === value
      ? { score: cur.score - value, myVote: null }                        // same arrow → unvote
      : { score: cur.score + value - (cur.myVote ?? 0), myVote: value };  // vote / switch
    pending = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();           // re-runs the load → fresh score/myVote → $effect clears optimistic
      pending = false;
    };
  };
</script>
<div class="flex items-center gap-1.5 rounded-xl border px-2 py-1"
     style="border-color:var(--line); background:var(--surface)">
  {#if !canVote && signinHref}
    <a href={signinHref} class="px-1" aria-label="Sign in to vote" style="color:var(--muted)">▲</a>
    <span class="min-w-5 text-center text-sm font-semibold tabular-nums" style="color:var(--ink)">{view.score}</span>
    <a href={signinHref} class="px-1" aria-label="Sign in to vote" style="color:var(--muted)">▼</a>
  {:else}
    <form method="POST" action={view.myVote === 1 ? '?/unvote' : '?/vote'} use:enhance={submit(1)}>
      <input type="hidden" name="value" value="1" />
      <button class="px-1 transition disabled:opacity-40" disabled={!canVote || pending} aria-label="Upvote"
              aria-pressed={view.myVote === 1}
              style="color:{view.myVote === 1 ? 'var(--green-deep)' : 'var(--muted)'}">▲</button>
    </form>
    <span class="min-w-5 text-center text-sm font-semibold tabular-nums" style="color:var(--ink)">{view.score}</span>
    <form method="POST" action={view.myVote === -1 ? '?/unvote' : '?/vote'} use:enhance={submit(-1)}>
      <input type="hidden" name="value" value="-1" />
      <button class="px-1 transition disabled:opacity-40" disabled={!canVote || pending} aria-label="Downvote"
              aria-pressed={view.myVote === -1}
              style="color:{view.myVote === -1 ? 'var(--neg)' : 'var(--muted)'}">▼</button>
    </form>
  {/if}
</div>
