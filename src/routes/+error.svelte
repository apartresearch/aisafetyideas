<script lang="ts">
  import { page } from '$app/state';
</script>
<section class="mx-auto max-w-xl p-12 text-center">
  <h1 class="text-4xl font-bold" style="color:var(--ink)">{page.status}</h1>
  <p style="color:var(--muted)">{page.error?.message ?? 'Something went wrong.'}</p>
  <a href="/" class="mt-4 inline-block" style="color:var(--green-deep)">← Home</a>
</section>
