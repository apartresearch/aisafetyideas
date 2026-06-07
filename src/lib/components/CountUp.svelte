<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { get } from 'svelte/store';
  import { dur, prefersReducedMotion } from '$lib/motion';
  import { formatCents } from '$lib/money';

  let { cents, currency = 'USD', reduced = get(prefersReducedMotion) }: {
    cents: number; currency?: string; reduced?: boolean;
  } = $props();

  // Intentional one-time capture: the tween's start value + duration are fixed at construction;
  // post-mount changes to `cents` are handled reactively by the $effect below.
  // svelte-ignore state_referenced_locally
  const value = tweened(reduced ? cents : 0, {
    duration: reduced ? 0 : dur.slow * 1000,
    easing: cubicOut
  });
  $effect(() => { value.set(cents); });
  const display = $derived(formatCents(Math.round($value), currency));
  const finalStr = $derived(formatCents(cents, currency));
</script>
<span style="position:relative; display:inline-block; font-variant-numeric:tabular-nums">
  <span aria-hidden="true" style="visibility:hidden">{finalStr}</span>
  <span data-countup-value style="position:absolute; left:0; top:0">{display}</span>
</span>
