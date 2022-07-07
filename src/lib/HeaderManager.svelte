
<script>
    import {ideaViewVisible, ideaCurrent} from "$lib/stores.js";

</script>

<svelte:head>
    <meta name="twitter:card" content="summary">
    <meta name="twitter:site" content="https://aisafetyideas.com">
    {#if $ideaViewVisible}
        <meta name="twitter:site" content="https://aisafetyideas.com?idea={$ideaCurrent.id}">
        <title>{$ideaCurrent.title + " | "}AI Safety Ideas</title>
        <meta name="twitter:title" content={$ideaCurrent.title}>
        <meta name="twitter:description" content={$ideaCurrent.summary}>
        <meta name="twitter:creator" content="{$ideaCurrent.author ? $ideaCurrent.author : $ideaCurrent.username}">
        <meta name="twitter:image:alt" content="{$ideaCurrent.title}">
        <meta name="og:title" content={$ideaCurrent.title}>
        <meta name="og:description" content={$ideaCurrent.summary}>
        <meta name="og:image" content="https://aisafetyideas.com/images/ogimage.png">
        <meta name="og:image:alt" content="{$ideaCurrent.title}">
        <meta name="og:url" content="https://aisafetyideas.com?idea={$ideaCurrent.id}">
        <meta name="og:type" content="article">
        <meta name="og:site_name" content="AI Safety Ideas">
        <meta name="og:locale" content="en_US">
        <meta name="og:locale:alternate" content="en_US">
    {/if}
</svelte:head>