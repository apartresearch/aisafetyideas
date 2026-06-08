<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let promoting = $state<Record<string, boolean>>({});
  let promoted = $state<Record<string, boolean>>({});
</script>

<h1 class="page-title">Idea submissions</h1>
<p class="page-sub">Archived ideas submitted by non-experts, awaiting admin review. Promote to make them publicly visible.</p>

{#if (form as any)?.message}
  <p class="form-error">{(form as any).message}</p>
{/if}

{#if data.archived.length === 0}
  <p class="empty-state">Nothing awaiting review.</p>
{:else}
  <div class="ideas-table-wrap">
    <table class="ideas-table">
      <thead>
        <tr>
          <th class="col-title">Title</th>
          <th class="col-author">Author</th>
          <th class="col-summary">Summary preview</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.archived as idea (idea.id)}
          <tr class:row-promoted={promoted[idea.id]}>
            <td class="col-title">
              <a href="/ideas/{idea.slug}" class="idea-link">{idea.title}</a>
            </td>
            <td class="col-author">
              {#if idea.author}
                <a href="/u/{idea.author.handle}" class="author-link">
                  {idea.author.display_name ?? idea.author.handle}
                </a>
              {:else}
                <span class="u-muted">Unknown</span>
              {/if}
            </td>
            <td class="col-summary">
              <span class="summary-preview">
                {(idea.summary_md ?? '').slice(0, 120)}{(idea.summary_md ?? '').length > 120 ? '…' : ''}
              </span>
            </td>
            <td class="col-actions">
              {#if promoted[idea.id]}
                <span class="promoted-badge">Promoted</span>
              {:else}
                <form
                  method="POST"
                  action="?/promote"
                  class="inline-form"
                  use:enhance={() => {
                    promoting = { ...promoting, [idea.id]: true };
                    return async ({ update }) => {
                      await update({ reset: false });
                      promoting = { ...promoting, [idea.id]: false };
                      if (form?.promoted !== false) promoted = { ...promoted, [idea.id]: true };
                    };
                  }}
                >
                  <input type="hidden" name="id" value={idea.id} />
                  <button
                    class="btn btn-sm"
                    style="color: var(--green-deep); border-color: color-mix(in srgb, var(--green-deep) 30%, transparent);"
                    disabled={promoting[idea.id]}
                  >
                    {promoting[idea.id] ? 'Promoting…' : 'Promote to open'}
                  </button>
                </form>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .page-title {
    font-size: 1.35rem; font-weight: 700; color: var(--ink); margin: 0 0 .4rem;
  }
  .page-sub {
    font-size: .875rem; color: var(--muted); margin: 0 0 1.5rem;
  }
  .form-error {
    font-size: .875rem; color: var(--neg); margin-bottom: 1rem;
  }
  .empty-state {
    color: var(--muted); font-size: .95rem;
  }

  .ideas-table-wrap { overflow-x: auto; }

  .ideas-table {
    width: 100%; border-collapse: collapse; font-size: .875rem;
  }
  .ideas-table thead tr {
    border-bottom: 1px solid var(--line-strong);
  }
  .ideas-table th {
    text-align: left; padding: .5rem .75rem;
    font-size: .7rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; color: var(--faint);
  }
  .ideas-table td {
    padding: .65rem .75rem; border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  .ideas-table tr:last-child td { border-bottom: none; }

  .col-title { width: 25%; }
  .col-author { width: 15%; }
  .col-summary { width: 45%; }
  .col-actions { width: 15%; text-align: right; }

  .idea-link {
    color: var(--ink); font-weight: 600; text-decoration: none;
  }
  .idea-link:hover { color: var(--green-deep); text-decoration: underline; }

  .author-link {
    color: var(--muted); text-decoration: none;
  }
  .author-link:hover { color: var(--ink); text-decoration: underline; }

  .summary-preview { color: var(--muted); line-height: 1.5; }

  .inline-form { display: inline; }

  .promoted-badge {
    font-size: .75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; color: var(--green-deep);
    padding: .2rem .5rem;
    background: color-mix(in srgb, var(--green-deep) 10%, transparent);
    border-radius: var(--r-chip);
  }

  .row-promoted td { opacity: .6; }

  .u-muted { color: var(--muted); }
</style>
