<script lang="ts">
  import '../app.css';
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  let { data, children } = $props();
  let supabase = $derived(data.supabase);

  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) invalidate('supabase:auth');
    });
    return () => subscription.unsubscribe();
  });
</script>

<header class="flex items-center justify-between border-b px-6 py-3"
        style="border-color:var(--line)">
  <a href="/" class="font-bold" style="color:var(--ink)">AI Safety Ideas</a>
  <nav class="flex gap-4" style="color:var(--muted)">
    {#if data.user}
      <a href="/dashboard">Dashboard</a>
      <form method="POST" action="/logout"><button type="submit">Sign out</button></form>
    {:else}
      <a href="/login">Sign in</a>
    {/if}
  </nav>
</header>

<main class="mx-auto max-w-5xl p-6">{@render children()}</main>
