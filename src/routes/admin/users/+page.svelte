<script lang="ts">
  let { data, form } = $props();
</script>

<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">User roles</h1>
<p class="mb-4 text-sm" style="color:var(--muted)">Grant or revoke expert and admin rights.</p>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

<table class="w-full text-sm">
  <thead>
    <tr style="color:var(--faint)">
      <th class="text-left py-2">Person</th>
      <th class="text-left">Expert</th>
      <th class="text-right">Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each data.users as u (u.id)}
      {@const isExpert = u.expert_status === 'approved'}
      {@const isSelf = u.id === data.currentUserId}
      <tr style="border-top:1px solid var(--line)">
        <td class="py-2" style="color:var(--ink)">
          {u.display_name ?? u.handle ?? u.id}
          {#if u.handle}<span style="color:var(--faint)"> @{u.handle}</span>{/if}
          {#if u.is_admin}<span class="ml-2 text-xs" style="color:var(--green-deep)">admin</span>{/if}
        </td>
        <td style="color:var(--muted)">{u.expert_status ?? '-'}</td>
        <td class="py-2 text-right">
          <form method="POST" action="?/setExpert" class="inline">
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="approved" value={isExpert ? 'false' : 'true'} />
            <button class="mr-3" style="color:{isExpert ? 'var(--neg)' : 'var(--green-deep)'}">
              {isExpert ? 'Remove expert' : 'Make expert'}
            </button>
          </form>
          {#if !isSelf}
            <form method="POST" action="?/setAdmin" class="inline">
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="is_admin" value={u.is_admin ? 'false' : 'true'} />
              <button style="color:{u.is_admin ? 'var(--neg)' : 'var(--green-deep)'}">
                {u.is_admin ? 'Remove admin' : 'Make admin'}
              </button>
            </form>
          {:else}
            <span class="text-xs" style="color:var(--faint)">(you)</span>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>
