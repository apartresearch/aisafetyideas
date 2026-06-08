<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import VoteControl from '$lib/components/VoteControl.svelte';
  import AnswerCard from '$lib/components/AnswerCard.svelte';
  import Money from '$lib/components/Money.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  let { data, form } = $props();
  let signinHref = $derived('/login?next=' + encodeURIComponent('/ideas/' + data.idea.slug));
</script>

<div class="idea-layout">
  <div class="idea-main">
    <article class="idea-hero card u-dots">
      <div class="idea-hero__top">
        <span class="u-label">{data.idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
        <div class="idea-hero__meta">
          <VoteControl score={data.score} myVote={data.myVote} canVote={data.canEngage} {signinHref} />
          <StatusBadge status={data.idea.status} />
        </div>
      </div>
      <h1 class="idea-hero__title">{data.idea.title}</h1>
      {#if data.author}
        <p class="idea-hero__byline">by <a href="/u/{data.author.handle}">{data.author.display_name ?? data.author.handle}</a></p>
      {/if}
      {#if data.idea.claim}
        <p class="idea-hero__claim font-serif">“{data.idea.claim}”</p>
      {/if}
      {#if data.summary_html}<Markdown html={data.summary_html} class="idea-hero__body" />{/if}
      {#if data.categories.length}
        <div class="idea-hero__cats">
          {#each data.categories as c}<span class="chip chip-line">{c.title}</span>{/each}
        </div>
      {/if}
      {#if data.idea.source_url}
        <p class="idea-hero__source"><a href={data.idea.source_url} target="_blank" rel="noopener">Source&nbsp;↗</a></p>
      {/if}
    </article>

    <section class="block">
      <div class="block__head">
        <h2 class="block__title">Answers <span class="block__count tnum">{data.answers.length}</span></h2>
        {#if data.canSubmit}<a href="/ideas/{data.idea.slug}/answer" class="btn btn-primary btn-sm">Submit an answer</a>{/if}
      </div>
      {#if data.answers.length === 0}
        <p class="block__empty">No answers yet{#if data.canSubmit} — be the first to respond.{/if}</p>
      {:else}
        <div class="stack">{#each data.answers as answer (answer.id)}<AnswerCard {answer} />{/each}</div>
      {/if}
    </section>

    <section class="block">
      <h2 class="block__title">Discussion <span class="block__count tnum">{data.comments.length}</span></h2>
      {#if data.canEngage}
        <form method="POST" action="?/comment" class="comment-form">
          <textarea name="body_md" required placeholder="Add a comment (markdown supported)" rows="3" class="textarea"></textarea>
          <button class="btn btn-secondary btn-sm comment-form__btn">Comment</button>
        </form>
      {/if}
      {#if data.comments.length === 0}
        <p class="block__empty">No comments yet.</p>
      {:else}
        <ul class="stack">
          {#each data.comments as c (c.id)}
            <li class="card comment">
              <div class="comment__head">
                <span class="comment__author">{c.author?.display_name ?? c.author?.handle ?? 'Anonymous'}</span>
                {#if data.userId === c.author_id || data.isAdmin}
                  <form method="POST" action="?/delete_comment">
                    <input type="hidden" name="comment_id" value={c.id} />
                    <button class="comment__delete">Delete</button>
                  </form>
                {/if}
              </div>
              <Markdown html={c.body_html} />
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>

  <aside class="idea-aside">
    <div class="idea-aside__sticky">
      <!-- Bounty -->
      <div class="card panel">
        <div class="panel__row">
          <span class="u-label">Pledged</span>
          <span class="panel__sub">{data.pot.funder_count} {data.pot.funder_count === 1 ? 'funder' : 'funders'}</span>
        </div>
        {#if data.pot.pot_cents > 0}
          <div class="panel__amount tnum"><Money cents={data.pot.pot_cents} currency={data.idea.currency ?? 'USD'} /></div>
        {:else}
          <p class="panel__hint">Open for funding — be the first to back this question.</p>
        {/if}

        {#if data.canFund}
          <form method="POST" action="?/pledge" class="fund">
            <label class="fund__label" for="fund-amount">Pledge an amount</label>
            <div class="fund__row">
              <span class="fund__cur">$</span>
              <input id="fund-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required class="input fund__input" />
            </div>
            <button class="btn btn-primary fund__btn">Pledge</button>
            <p class="fund__note">A pledge is a commitment — no funds move yet.</p>
          </form>
        {/if}
      </div>

      <!-- Interest -->
      <div class="card panel">
        <div class="panel__row">
          <span class="u-label">Interested researchers</span>
          <span class="panel__sub tnum">{data.interestCount}</span>
        </div>
        {#if data.canEngage}
          {#if data.myInterestId}
            <form method="POST" action="?/uninterest">
              <button class="btn btn-secondary panel__action panel__action--on">Interested ✓ — withdraw</button>
            </form>
          {:else}
            <form method="POST" action="?/interest">
              <button class="btn btn-primary panel__action">I’m interested</button>
            </form>
          {/if}
        {:else}
          <a href={signinHref} class="btn btn-secondary panel__action">Sign in to follow</a>
        {/if}
      </div>

      <!-- Funders -->
      {#if data.funders.length}
        <div class="card panel">
          <span class="u-label">Funders</span>
          <ul class="funders">
            {#each data.funders as f (f.key)}
              <li class="funders__row">
                <span class="funders__name">{f.name}</span>
                <span class="tnum funders__amt"><Money cents={f.amount_cents} currency={f.currency} /></span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if form?.message}<p class="idea-aside__err">{form.message}</p>{/if}
    </div>
  </aside>
</div>

<style>
  .idea-layout { display: grid; gap: 2rem; align-items: start; }
  @media (min-width: 960px) { .idea-layout { grid-template-columns: 1fr 320px; } }

  /* Hero card */
  .idea-hero { padding: 1.75rem; background-color: var(--surface); }
  .idea-hero__top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .idea-hero__meta { display: flex; align-items: center; gap: .6rem; }
  .idea-hero__title { margin-top: 1rem; font-size: clamp(1.7rem, 3.5vw, 2.3rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.12; }
  .idea-hero__byline { margin-top: .6rem; font-size: .9rem; color: var(--faint); }
  .idea-hero__byline a { color: var(--green-deep); }
  .idea-hero__byline a:hover { text-decoration: underline; text-underline-offset: 2px; }
  .idea-hero__claim { margin-top: 1.1rem; font-size: 1.2rem; line-height: 1.5; color: var(--ink-2); font-style: italic; border-left: 3px solid var(--green); padding-left: 1rem; }
  :global(.idea-hero__body) { margin-top: 1.1rem; }
  .idea-hero__cats { margin-top: 1.4rem; display: flex; flex-wrap: wrap; gap: .5rem; }
  .idea-hero__source { margin-top: 1.1rem; font-size: .9rem; }
  .idea-hero__source a { color: var(--green-deep); }

  /* Content blocks */
  .block { margin-top: 2.5rem; }
  .block__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.1rem; }
  .block__title { font-size: 1.3rem; font-weight: 700; color: var(--ink); }
  .block__count { margin-left: .4rem; font-size: .95rem; font-weight: 600; color: var(--faint); }
  .block__empty { color: var(--muted); font-size: .95rem; }
  .stack { display: flex; flex-direction: column; gap: .9rem; }

  /* Comments */
  .comment-form { display: flex; flex-direction: column; gap: .65rem; margin-bottom: 1.25rem; }
  .comment-form__btn { align-self: flex-start; }
  .comment { padding: 1.1rem 1.2rem; }
  .comment__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .35rem; }
  .comment__author { font-size: .88rem; font-weight: 600; color: var(--body); }
  .comment__delete { font-size: .76rem; color: var(--neg); cursor: pointer; }
  .comment__delete:hover { text-decoration: underline; }

  /* Aside */
  .idea-aside__sticky { display: flex; flex-direction: column; gap: 1rem; }
  @media (min-width: 960px) { .idea-aside__sticky { position: sticky; top: 5rem; } }
  .panel { padding: 1.2rem; }
  .panel__row { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; }
  .panel__sub { font-size: .8rem; color: var(--muted); }
  .panel__amount { margin-top: .35rem; font-size: 1.85rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
  .panel__hint { margin-top: .5rem; font-size: .88rem; color: var(--muted); line-height: 1.5; }
  .panel__action { width: 100%; margin-top: .9rem; }
  .panel__action--on { color: var(--green-deep); border-color: color-mix(in srgb, var(--green) 55%, transparent); }

  .fund { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  .fund__label { display: block; font-size: .82rem; font-weight: 600; color: var(--muted); margin-bottom: .45rem; }
  .fund__row { position: relative; display: flex; align-items: center; }
  .fund__cur { position: absolute; left: .8rem; color: var(--faint); font-weight: 600; pointer-events: none; }
  .fund__input { padding-left: 1.6rem; }
  .fund__btn { width: 100%; margin-top: .65rem; }
  .fund__note { margin-top: .55rem; font-size: .76rem; color: var(--faint); line-height: 1.45; }

  .funders { margin-top: .75rem; display: flex; flex-direction: column; gap: .5rem; }
  .funders__row { display: flex; justify-content: space-between; gap: .75rem; font-size: .9rem; }
  .funders__name { color: var(--body); }
  .funders__amt { color: var(--ink); font-weight: 600; }

  .idea-aside__err { font-size: .85rem; color: var(--neg); }
</style>
