<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let pending = $state<Record<string, boolean>>({});
  let done = $state<Record<string, string>>({});

  function moderateEnhance(id: string) {
    return () => {
      pending = { ...pending, [id]: true };
      return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
        await update({ reset: false });
        pending = { ...pending, [id]: false };
        if ((form as any)?.moderated === true) done = { ...done, [id]: (form as any).action };
      };
    };
  }

  const doneLabel: Record<string, string> = {
    approve: 'Approved', request_changes: 'Changes requested', reject: 'Rejected'
  };
</script>

<h1 class="page-title">Idea review queue</h1>
<p class="page-sub">Submissions from non-experts awaiting moderation. Approve to publish, request changes to send back to the author as a draft, or reject to archive.</p>

{#if (form as any)?.message}
  <p class="form-error">{(form as any).message}</p>
{/if}

{#if data.review.length === 0}
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
        {#each data.review as idea (idea.id)}
          <tr class:row-done={done[idea.id]}>
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
              {#if done[idea.id]}
                <span class="done-badge">{doneLabel[done[idea.id]] ?? 'Done'}</span>
              {:else}
                <div class="action-row">
                  <form method="POST" action="?/moderate" class="inline-form" use:enhance={moderateEnhance(idea.id)}>
                    <input type="hidden" name="id" value={idea.id} />
                    <input type="hidden" name="action" value="approve" />
                    <button class="btn btn-sm action-approve" disabled={pending[idea.id]}>Approve</button>
                  </form>
                  <form method="POST" action="?/moderate" class="inline-form" use:enhance={moderateEnhance(idea.id)}>
                    <input type="hidden" name="id" value={idea.id} />
                    <input type="hidden" name="action" value="request_changes" />
                    <button class="btn btn-sm action-changes" disabled={pending[idea.id]}>Request changes</button>
                  </form>
                  <form method="POST" action="?/moderate" class="inline-form" use:enhance={moderateEnhance(idea.id)}>
                    <input type="hidden" name="id" value={idea.id} />
                    <input type="hidden" name="action" value="reject" />
                    <button class="btn btn-sm action-reject" disabled={pending[idea.id]}>Reject</button>
                  </form>
                </div>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if data.archived.length > 0}
  <h2 class="section-title">Archived</h2>
  <p class="page-sub">Previously rejected or hidden ideas. Promote to make publicly visible.</p>
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
          <tr class:row-done={done[idea.id]}>
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
              {#if done[idea.id]}
                <span class="done-badge">Promoted</span>
              {:else}
                <form method="POST" action="?/promote" class="inline-form" use:enhance={moderateEnhance(idea.id)}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button class="btn btn-sm action-approve" disabled={pending[idea.id]}>Promote to open</button>
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
  .section-title {
    font-size: 1.05rem; font-weight: 700; color: var(--ink); margin: 2.5rem 0 .4rem;
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

  .col-title { width: 24%; }
  .col-author { width: 14%; }
  .col-summary { width: 38%; }
  .col-actions { width: 24%; text-align: right; }

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
  .action-row {
    display: inline-flex; gap: .4rem; flex-wrap: wrap; justify-content: flex-end;
  }

  .action-approve {
    color: var(--green-deep);
    border-color: color-mix(in srgb, var(--green-deep) 30%, transparent);
  }
  .action-changes {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 30%, transparent);
  }
  .action-reject {
    color: var(--neg);
    border-color: color-mix(in srgb, var(--neg) 30%, transparent);
  }

  .done-badge {
    font-size: .75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; color: var(--green-deep);
    padding: .2rem .5rem;
    background: color-mix(in srgb, var(--green-deep) 10%, transparent);
    border-radius: var(--r-chip);
  }

  .row-done td { opacity: .6; }

  .u-muted { color: var(--muted); }
</style>
