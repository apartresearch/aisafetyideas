<script lang="ts">
  import '../app.css';
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  import Logo from '$lib/components/Logo.svelte';
  let { data, children } = $props();
  let supabase = $derived(data.supabase);

  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) invalidate('supabase:auth');
    });
    return () => subscription.unsubscribe();
  });
</script>

<div class="site">
  <header class="site-header">
    <div class="site-header__inner">
      <a href="/" class="site-brand" aria-label="AI Safety Ideas - home">
        <Logo size={26} />
        <span class="site-brand__name">AI&nbsp;Safety&nbsp;Ideas</span>
      </a>
      <nav class="site-nav">
        <a href="/ideas" class="site-nav__link">Ideas</a>
        <a href="/experts" class="site-nav__link">Experts</a>
        {#if data.user}
          <a href="/dashboard" class="site-nav__link">Dashboard</a>
          {#if data.isAdmin}
            <a href="/admin" class="site-nav__link">Admin</a>
          {/if}
          <form method="POST" action="/logout" class="contents">
            <button type="submit" class="btn btn-secondary btn-sm">Sign out</button>
          </form>
        {:else}
          <a href="/login" class="btn btn-primary btn-sm">Sign in</a>
        {/if}
      </nav>
    </div>
  </header>

  <main class="site-main">{@render children()}</main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <a href="/" class="site-brand"><Logo size={22} /><span class="site-brand__name">AI&nbsp;Safety&nbsp;Ideas</span></a>
        <p class="site-footer__mission">
          A charitable research-bounty platform - experts post the open questions in AI safety,
          funders back them, researchers answer.
        </p>
      </div>
      <nav class="site-footer__links" aria-label="Footer">
        <a href="/ideas">Browse ideas</a>
        <a href="/experts">Experts</a>
        <a href="/login">Sign in</a>
      </nav>
      <p class="site-footer__legal">
        Donations support a 501(c)(3) charitable mission. © {new Date().getFullYear()} AI Safety Ideas.
      </p>
    </div>
  </footer>
</div>
