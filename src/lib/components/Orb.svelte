<script lang="ts">
  // The brand mascot: a soft green→deep-green sphere. The one sanctioned "large green" surface
  // (CLAUDE.md §6). Floats slowly; pauses under reduced motion.
  let { size = 200 }: { size?: number } = $props();
</script>
<div class="orb" style="width:{size}px; height:{size}px" aria-hidden="true"></div>
<style>
  .orb {
    border-radius: 9999px;
    background: radial-gradient(circle at 35% 30%, var(--green-bright), var(--green) 42%, var(--green-deep) 100%);
    box-shadow: 0 24px 70px -12px rgba(28, 219, 114, 0.45), inset 0 -12px 34px rgba(20, 24, 22, 0.18);
    animation: orb-float 6s var(--ease-in-out) infinite alternate;
    will-change: transform;
  }
  @keyframes orb-float {
    from { transform: translateY(0) scale(1); }
    to   { transform: translateY(-16px) scale(1.03); }
  }
  @media (prefers-reduced-motion: reduce) { .orb { animation: none; } }
</style>
