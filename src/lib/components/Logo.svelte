<script lang="ts">
  // Brand mark: a small static version of the brand orb (the one sanctioned green surface).
  // Pairs with the Sora wordmark in the header/footer.
  let { size = 26 }: { size?: number } = $props();
</script>
<span class="logo" style="width:{size}px; height:{size}px" aria-hidden="true"></span>
<style>
  .logo {
    flex: none;
    border-radius: 9999px;
    background: radial-gradient(circle at 34% 30%, var(--green-bright), var(--green) 45%, var(--green-deep) 100%);
    box-shadow: 0 2px 8px -1px rgba(28, 219, 114, 0.5), inset 0 -2px 5px rgba(20, 24, 22, 0.22);
  }
</style>
