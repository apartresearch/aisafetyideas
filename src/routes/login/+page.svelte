<script lang="ts">
  let { form } = $props();
</script>
<section class="mx-auto max-w-sm p-8">
  <h1 class="mb-6 text-2xl font-bold" style="color:var(--ink)">Sign in</h1>
  <form method="POST" action="?/google" class="mb-4">
    <button class="w-full rounded-xl border py-2" style="border-color:var(--line)">Continue with Google</button>
  </form>
  <form method="POST" action="?/magiclink" class="flex flex-col gap-2">
    <input name="email" type="email" required placeholder="you@email.com"
           class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
    <button class="rounded-xl py-2 font-medium" style="background:var(--ink);color:#fff">Email me a link</button>
  </form>
  {#if form?.sent}<p class="mt-3" style="color:var(--green-deep)">Check your email for the link.</p>{/if}
  {#if form?.message}<p class="mt-3" style="color:var(--neg)">{form.message}</p>{/if}
</section>
