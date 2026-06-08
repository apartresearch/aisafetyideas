<script lang="ts">
  // Greyscale inline spinner for ≤1s actions (infinite-scroll fetch). Reduced-motion → static ring.
  let { size = 18, label = 'Loading' }: { size?: number; label?: string } = $props();
</script>
<span class="spinner" style="width:{size}px; height:{size}px" role="status" aria-label={label}></span>
<style>
  .spinner {
    display: inline-block; border-radius: 9999px;
    border: 2px solid var(--line-strong); border-top-color: var(--muted);
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
