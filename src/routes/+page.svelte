<script lang="ts">
  import Orb from '$lib/components/Orb.svelte';
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  let { data } = $props();

  const steps = [
    { n: '01', t: 'Experts post ideas', d: 'Vetted researchers publish concrete AI-safety questions and hypotheses worth investigating.' },
    { n: '02', t: 'Funders back them', d: 'Supporters pledge toward the questions they want answered - building transparent, pooled support.' },
    { n: '03', t: 'Researchers answer', d: 'Anyone can submit an answer with evidence and artifacts - code, papers, notebooks.' },
    { n: '04', t: 'Verified payouts', d: 'The author verifies a result and the payout is recorded - a clear path from question to impact.' }
  ];
</script>

<!-- ── Hero ── -->
<section class="full-bleed hero">
  <div class="hero__inner">
    <div class="hero__copy">
      <span class="u-label reveal" style="animation-delay:40ms">Charitable research · AI safety</span>
      <h1 class="hero__title reveal" style="animation-delay:90ms">
        Fund the AI safety research that matters.
      </h1>
      <p class="hero__lede font-serif reveal" style="animation-delay:150ms">
        Experts post the open questions. Funders back the ones worth answering. Researchers
        submit evidence - and when an author verifies a result, the payout is recorded.
        A transparent path from open question to real impact.
      </p>
      <div class="hero__cta reveal" style="animation-delay:210ms">
        <a href="/ideas" class="btn btn-primary btn-lg">Browse ideas</a>
        <a href={data.signedIn ? '/dashboard' : '/login'} class="btn btn-secondary btn-lg">
          {data.signedIn ? 'Your dashboard' : 'Sign in'}
        </a>
      </div>
      {#if data.ideaCount > 0}
        <dl class="hero__stats reveal" style="animation-delay:280ms">
          <div>
            <dt class="u-label">Open ideas</dt>
            <dd class="hero__stat tnum">{data.ideaCount.toLocaleString()}</dd>
          </div>
          {#if data.expertCount > 0}
            <div>
              <dt class="u-label">Vetted experts</dt>
              <dd class="hero__stat tnum">{data.expertCount.toLocaleString()}</dd>
            </div>
          {/if}
        </dl>
      {/if}
    </div>
    <div class="hero__orb reveal" style="animation-delay:120ms"><Orb size={230} /></div>
  </div>
</section>

<!-- ── How it works ── -->
<section class="section">
  <h2 class="u-label section__eyebrow">How it works</h2>
  <ol class="steps">
    {#each steps as s (s.n)}
      <li class="card card-hover step">
        <span class="step__n tnum">{s.n}</span>
        <h3 class="step__t">{s.t}</h3>
        <p class="step__d">{s.d}</p>
      </li>
    {/each}
  </ol>
</section>

<!-- ── Recent ideas (degrades: hidden when empty) ── -->
{#if data.recent.length}
  <section class="section">
    <div class="section__head">
      <h2 class="section__title">Recent ideas</h2>
      <a href="/ideas" class="section__more">Browse all&nbsp;→</a>
    </div>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.recent as idea (idea.id)}<IdeaCard {idea} />{/each}
    </div>
  </section>
{/if}

<!-- ── Closing CTA (rare neutral-dark panel; green stays an accent) ── -->
<section class="section">
  <div class="closing">
    <div class="closing__orb"><Orb size={120} /></div>
    <h2 class="closing__title">Back the questions that move AI safety forward.</h2>
    <p class="closing__lede">
      Donations support a 501(c)(3) charitable mission; funds are recorded as intended payouts
      to the researchers whose answers are verified.
    </p>
    <div class="closing__cta">
      <a href="/ideas" class="btn btn-lg closing__primary">Explore the ideas</a>
      <a href="/experts" class="btn btn-lg closing__ghost">Meet the experts</a>
    </div>
  </div>
</section>

<style>
  /* Hero */
  .hero {
    margin-top: -2.5rem; /* sit flush under the sticky header (cancels .site-main top padding) */
    background: var(--canvas);
    background-image: radial-gradient(var(--line) 1px, transparent 1px);
    background-size: 22px 22px;
    border-bottom: 1px solid var(--line);
    position: relative;
    overflow: hidden;
  }
  .hero::before { /* soft green atmosphere bleeding from the orb side */
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(60% 70% at 88% 22%, rgba(68, 255, 152, 0.14), transparent 70%);
  }
  .hero__inner {
    position: relative; max-width: 72rem; margin-inline: auto;
    padding: clamp(3.5rem, 8vw, 6rem) 1.5rem clamp(3rem, 6vw, 5rem);
    display: grid; gap: 2.5rem; align-items: center;
  }
  @media (min-width: 900px) { .hero__inner { grid-template-columns: 1.45fr 1fr; } }
  .hero__title {
    margin-top: 1rem; font-size: clamp(2.4rem, 5.4vw, 3.9rem); font-weight: 700;
    letter-spacing: -0.03em; line-height: 1.02; color: var(--ink); max-width: 16ch;
  }
  .hero__lede { margin-top: 1.25rem; max-width: 36rem; font-size: clamp(1.05rem, 1.6vw, 1.2rem); color: var(--body); line-height: 1.6; }
  .hero__cta { margin-top: 1.9rem; display: flex; flex-wrap: wrap; gap: .7rem; }
  .hero__stats { margin-top: 2.4rem; display: flex; gap: 2.75rem; }
  .hero__stat { font-size: 1.9rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; margin-top: .15rem; }
  .hero__orb { display: flex; justify-content: center; }
  @media (min-width: 900px) { .hero__orb { justify-content: flex-end; } }

  /* Sections */
  .section { max-width: 72rem; margin: clamp(3.5rem, 7vw, 5.5rem) auto 0; }
  .section__eyebrow { margin-bottom: 1.5rem; }
  .section__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; }
  .section__title { font-size: 1.5rem; font-weight: 700; }
  .section__more { color: var(--green-deep); font-weight: 600; font-size: .92rem; white-space: nowrap; }
  .section__more:hover { color: var(--green-deep); text-decoration: underline; text-underline-offset: 3px; }

  /* Steps */
  .steps { display: grid; gap: 1.1rem; grid-template-columns: 1fr; list-style: none; }
  @media (min-width: 640px) { .steps { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .steps { grid-template-columns: repeat(4, 1fr); } }
  .step { padding: 1.4rem; }
  .step__n { font-size: .85rem; font-weight: 700; color: var(--green-deep); letter-spacing: .05em; }
  .step__t { margin-top: .7rem; font-size: 1.02rem; font-weight: 700; color: var(--ink); }
  .step__d { margin-top: .4rem; font-size: .9rem; color: var(--muted); line-height: 1.55; }

  /* Closing */
  .closing {
    position: relative; overflow: hidden;
    background: var(--surface-dk); color: var(--on-dark);
    border-radius: var(--r-card); padding: clamp(2.5rem, 5vw, 4rem) 1.5rem; text-align: center;
  }
  .closing::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
    background: radial-gradient(50% 80% at 50% -10%, rgba(68, 255, 152, 0.18), transparent 70%);
  }
  .closing__orb { position: relative; display: flex; justify-content: center; margin-bottom: 1.4rem; opacity: .95; }
  .closing__title { position: relative; font-size: clamp(1.6rem, 3.2vw, 2.2rem); font-weight: 700; color: #fff; letter-spacing: -0.02em; max-width: 22ch; margin-inline: auto; }
  .closing__lede { position: relative; margin: .9rem auto 0; max-width: 40rem; color: rgba(245, 246, 245, 0.72); font-size: .98rem; line-height: 1.6; }
  .closing__cta { position: relative; margin-top: 1.9rem; display: flex; flex-wrap: wrap; gap: .7rem; justify-content: center; }
  .closing__primary { background: #fff; color: var(--ink); }
  .closing__primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,.3); }
  .closing__ghost { color: var(--on-dark); border-color: rgba(245, 246, 245, 0.25); }
  .closing__ghost:hover { border-color: rgba(245, 246, 245, 0.6); transform: translateY(-1px); }
</style>
