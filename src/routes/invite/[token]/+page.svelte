<script lang="ts">
  let { data } = $props();
</script>

<div class="mx-auto mt-24 max-w-md px-6 text-center">
  <div class="mb-6 text-4xl" aria-hidden="true">⚠</div>
  <h1 class="mb-3 text-2xl font-bold" style="color:var(--ink)">Invite redemption failed</h1>
  <p class="mb-6 text-sm leading-relaxed" style="color:var(--body)">
    {data.error}
  </p>
  <div class="flex justify-center gap-4">
    <a href="/"
      class="rounded-[var(--r-pill)] border px-5 py-2 text-sm font-medium transition-transform active:scale-[.97]"
      style="border-color:var(--line-strong);color:var(--ink);transition-duration:var(--dur-fast)">
      Home
    </a>
    <a href="/console"
      class="rounded-[var(--r-pill)] px-5 py-2 text-sm font-medium transition-transform active:scale-[.97]"
      style="background:var(--ink);color:#fff;transition-duration:var(--dur-fast)">
      Go to console
    </a>
  </div>
</div>
