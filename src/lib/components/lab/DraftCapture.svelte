<script lang="ts">
  let { store }: { store: { add: (title: string) => Promise<void> } } = $props();
  let value = $state('');
  let el: HTMLInputElement | undefined;

  $effect(() => {
    el?.focus();
  });

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
  bind:this={el}
  onkeydown={onKeydown}
  aria-label="Capture new draft idea"
/>
