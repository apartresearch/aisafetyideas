<script lang="ts">
  // Calm greyscale shimmer placeholder mirroring IdeaCard's shape (CLAUDE.md: skeletons over
  // spinners for content). Shimmer becomes a static tint under reduced motion.
</script>
<div class="card sk" aria-hidden="true">
  <div class="sk__row">
    <span class="sk__bar" style="width:5.5rem"></span>
    <span class="sk__bar" style="width:3.5rem"></span>
  </div>
  <span class="sk__bar sk__title" style="width:85%"></span>
  <span class="sk__bar" style="width:95%"></span>
  <span class="sk__bar" style="width:70%"></span>
  <div class="sk__foot"><span class="sk__bar" style="width:4rem"></span></div>
</div>
<style>
  .sk { display: flex; flex-direction: column; gap: .7rem; padding: 1.35rem; height: 100%; }
  .sk__row { display: flex; justify-content: space-between; }
  .sk__bar {
    height: .72rem; border-radius: 6px;
    background: linear-gradient(90deg, var(--surface-2) 0%, color-mix(in srgb, var(--line-strong) 60%, var(--surface-2)) 50%, var(--surface-2) 100%);
    background-size: 200% 100%; animation: shimmer 1.3s var(--ease-in-out) infinite;
  }
  .sk__title { height: 1.15rem; margin-top: .35rem; }
  .sk__foot { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--line); }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .sk__bar { animation: none; background: var(--surface-2); } }
</style>
