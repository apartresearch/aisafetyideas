<script lang="ts">
  import { get } from 'svelte/store';
  import { prefersReducedMotion } from '$lib/motion';

  let { play = false, tone = 'verified', size = 20, reduced = get(prefersReducedMotion) }: {
    play?: boolean; tone?: 'verified' | 'rejected'; size?: number; reduced?: boolean;
  } = $props();

  const LEN = 20; // approx length of the check polyline for the draw
  // drawn immediately when static or reduced; otherwise start undrawn then flip next frame to transition
  // svelte-ignore state_referenced_locally
  let drawn = $state(!play || reduced);
  $effect(() => {
    if (play && !reduced && typeof requestAnimationFrame === 'function') {
      drawn = false;
      requestAnimationFrame(() => { drawn = true; });
    } else {
      drawn = true;
    }
  });
</script>

<svg width={size} height={size} viewBox="0 0 24 24"
     class:pop={play && !reduced && tone === 'verified'}
     aria-hidden="true" style="display:inline-block; vertical-align:middle">
  {#if tone === 'verified'}
    <circle cx="12" cy="12" r="11" fill="var(--green)" />
    <path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke="var(--ink)" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round"
          style="stroke-dasharray:{LEN}; stroke-dashoffset:{drawn ? 0 : LEN};
                 transition:stroke-dashoffset var(--dur-base) var(--ease-snappy)" />
  {:else}
    <circle cx="12" cy="12" r="11" fill="none" stroke="var(--neg)" stroke-width="2" />
    <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="var(--neg)" stroke-width="2.2"
          stroke-linecap="round" style="stroke-dashoffset:0" />
  {/if}
</svg>

<style>
  .pop { transform-origin: center; animation: seal-pop var(--dur-base) var(--ease-snappy); }
  @keyframes seal-pop { 0% { transform: scale(1); } 45% { transform: scale(1.12); } 100% { transform: scale(1); } }
</style>
