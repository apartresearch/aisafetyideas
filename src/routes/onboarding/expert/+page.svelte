<script lang="ts">
  import { page } from '$app/state';

  const already = $derived(page.url.searchParams.get('already') === '1');
</script>

<svelte:head>
  <title>Welcome, expert — AI Safety Ideas</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16">

  <!-- Accent mark -->
  <div class="mb-8">
    <span class="inline-block rounded-[var(--r-chip)] px-3 py-1 text-xs font-semibold uppercase tracking-[.06em]"
      style="background:var(--green);color:var(--ink)">
      {already ? 'Already an expert' : 'Expert access granted'}
    </span>
  </div>

  {#if already}
    <h1 class="mb-4 font-serif text-3xl leading-tight" style="color:var(--ink);font-family:'Lora',serif">
      You're already an expert.
    </h1>
    <p class="mb-8 text-base leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
      Your account already has approved-expert status. Head to the console to author ideas and manage your research bounties.
    </p>
  {:else}
    <h1 class="mb-4 font-serif text-3xl leading-tight" style="color:var(--ink);font-family:'Lora',serif">
      Welcome to the expert roster.
    </h1>
    <p class="mb-8 text-base leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
      You can now post research ideas and have funders attach money to them. When a strong answer arrives,
      you verify it — and the payout flows. Here's how to write an idea that earns serious attention.
    </p>
  {/if}

  {#if !already}
  <!-- Writing guide -->
  <section class="mb-10 rounded-[var(--r-card)] border p-6" style="border-color:var(--line-strong);background:var(--surface)">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-[.06em]" style="color:var(--faint)">
      How to write a strong idea
    </h2>

    <ol class="space-y-5">
      <li class="flex gap-4">
        <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style="background:var(--surface-2);color:var(--ink)">1</span>
        <div>
          <p class="font-semibold" style="color:var(--ink)">One-sentence summary</p>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
            State the core question or claim in a single sentence a non-specialist can parse.
            This becomes the headline funders and submitters see first.
          </p>
        </div>
      </li>
      <li class="flex gap-4">
        <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style="background:var(--surface-2);color:var(--ink)">2</span>
        <div>
          <p class="font-semibold" style="color:var(--ink)">The claim or question</p>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
            Be precise. <em>Open-ended:</em> ask a research question with clear scope.
            <em>Hypothesis:</em> make a falsifiable claim with a yes/no resolution condition.
            Vague questions attract vague answers.
          </p>
        </div>
      </li>
      <li class="flex gap-4">
        <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style="background:var(--surface-2);color:var(--ink)">3</span>
        <div>
          <p class="font-semibold" style="color:var(--ink)">Why it matters</p>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
            Connect the question to a concrete AI-safety concern. What decision or research direction
            does a good answer unlock? One paragraph is enough.
          </p>
        </div>
      </li>
      <li class="flex gap-4">
        <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style="background:var(--surface-2);color:var(--ink)">4</span>
        <div>
          <p class="font-semibold" style="color:var(--ink)">What a good answer looks like</p>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
            Describe the evidence, methodology, or artefacts you'd need to verify an answer.
            This is your verification rubric — be specific enough that a well-qualified submitter
            knows what to produce, and that your future self can apply it consistently.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <!-- Tips -->
  <section class="mb-10 rounded-[var(--r-card)] border p-6" style="border-color:var(--line);background:var(--surface-2)">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-[.06em]" style="color:var(--faint)">
      Tips from the platform
    </h2>
    <ul class="space-y-2 text-sm leading-relaxed" style="color:var(--body);font-family:'Lora',serif">
      <li>Set a realistic payout range in mind before publishing — funders use it to calibrate pledges.</li>
      <li>Narrow scope beats broad scope. A tight question with a $5k bounty gets better answers than a vague one with $50k.</li>
      <li>You can revise a draft before publishing; once open, funders may start pledging.</li>
      <li>You verify answers — take the rubric seriously. Verification is permanent and triggers payout.</li>
    </ul>
  </section>
  {/if}

  <a href="/console"
    class="inline-block rounded-[var(--r-pill)] px-6 py-3 text-sm font-medium transition-transform active:scale-[.97]"
    style="background:var(--ink);color:#fff;transition-duration:var(--dur-fast)">
    {already ? 'Open console' : 'Author my first idea →'}
  </a>

</main>
