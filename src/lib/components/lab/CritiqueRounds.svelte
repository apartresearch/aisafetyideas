<script lang="ts">
  import { REVIEWERS } from '$lib/lab/critique';

  let { rounds }: { rounds: any[] } = $props();

  // Newest first
  const sorted = $derived([...rounds].reverse());
</script>

{#if sorted.length > 0}
  <div class="rounds">
    {#each sorted as round (round.round)}
      <div class="round card">
        <p class="u-label round__label">Review round {round.round}</p>
        {#each round.reviewers as reviewer}
          {@const label = REVIEWERS.find((r) => r.key === reviewer.persona)?.label ?? reviewer.persona}
          <div class="reviewer">
            <p class="reviewer__name">{label}</p>
            {#if reviewer.comments?.length}
              <ul class="reviewer__list">
                {#each reviewer.comments as comment}
                  <li class="reviewer__item">{comment}</li>
                {/each}
              </ul>
            {/if}
            {#if reviewer.questions?.length}
              <ul class="reviewer__list reviewer__list--questions">
                {#each reviewer.questions as question}
                  <li class="reviewer__item reviewer__item--question">
                    <span class="reviewer__q-mark" aria-hidden="true">?</span>
                    {question}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  .rounds { display: flex; flex-direction: column; gap: .75rem; margin-top: .75rem; }

  .round { padding: 1rem; }
  .round__label { margin-bottom: .75rem; }

  .reviewer { margin-bottom: .75rem; }
  .reviewer:last-child { margin-bottom: 0; }
  .reviewer__name {
    font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
    color: var(--faint); margin-bottom: .35rem;
  }

  .reviewer__list { list-style: none; padding: 0; margin: 0 0 .35rem; display: flex; flex-direction: column; gap: .25rem; }
  .reviewer__list:last-child { margin-bottom: 0; }

  .reviewer__item { font-size: .88rem; color: var(--body); line-height: 1.5; padding-left: .9rem; position: relative; }
  .reviewer__item::before { content: '·'; position: absolute; left: 0; color: var(--faint); }

  .reviewer__list--questions .reviewer__item { color: var(--muted); font-style: italic; }
  .reviewer__item--question { padding-left: 1.2rem; }
  .reviewer__item--question::before { content: ''; }
  .reviewer__q-mark {
    position: absolute; left: 0; font-size: .72rem; font-weight: 800; font-style: normal;
    color: var(--green-deep); line-height: 1.5;
  }
</style>
