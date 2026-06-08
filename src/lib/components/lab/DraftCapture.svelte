<script lang="ts">
  let { store }: { store: { add: (title: string) => Promise<void> } } = $props();
  let value = $state('');

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) {
      store.add(value.trim());
      value = '';
    }
  }
</script>

<input
  class="input"
  placeholder="New idea…"
  bind:value
  onkeydown={onKeydown}
  autofocus
  aria-label="Capture new draft idea"
/>
