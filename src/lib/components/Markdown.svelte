<script lang="ts">
  // `html` MUST be the output of $lib/server/markdown#renderMarkdown (already sanitized server-side).
  let { html, class: klass = '' }: { html: string; class?: string } = $props();
</script>
{#if html}
  <!-- eslint-disable-next-line svelte/no-at-html-tags — server-sanitized via renderMarkdown -->
  <div class="prose-sm {klass}" style="color:var(--body)">{@html html}</div>
{/if}
