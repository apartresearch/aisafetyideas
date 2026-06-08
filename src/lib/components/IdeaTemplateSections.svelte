<script lang="ts">
  import Markdown from './Markdown.svelte';

  let {
    resolution_criteria_html = '',
    methodology_html = '',
    theory_of_change_html = '',
    extensions_html = '',
  }: {
    resolution_criteria_html?: string;
    methodology_html?: string;
    theory_of_change_html?: string;
    extensions_html?: string;
  } = $props();

  const sections = $derived([
    { key: 'resolution_criteria', label: 'Resolution Criteria', html: resolution_criteria_html },
    { key: 'methodology',         label: 'Methodology',         html: methodology_html },
    { key: 'theory_of_change',    label: 'Theory of Change',    html: theory_of_change_html },
    { key: 'extensions',          label: 'Extensions',          html: extensions_html },
  ].filter(s => s.html && s.html.trim().length > 0));
</script>

{#each sections as s (s.key)}
  <section class="tpl-section">
    <h3 class="u-label tpl-section__heading">{s.label}</h3>
    <Markdown html={s.html} />
  </section>
{/each}

<style>
  .tpl-section { margin-top: 2rem; }
  .tpl-section__heading { margin-bottom: .65rem; }
</style>
