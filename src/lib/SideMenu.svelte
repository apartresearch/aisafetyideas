<script>
  export let open;
  export let duration;
  export let width;
  export let padding;
  export let paddingTop;
  export let backgroundColor;
  export let menuColor;
</script>

<div
  id="container"
  style="background-color: {backgroundColor}; color: {menuColor}; width: {width}; left: {open
    ? '0px'
    : '-' + width}; transition: left {duration}s ease-in-out"
>
  <div id="menu" style="padding: {padding}; padding-top: {paddingTop};">
    <slot />
  </div>
</div>

<style>
  #container {
    position: fixed;
    height: 100vh;
    top: 0px;
    overflow-y: auto;
  }

  #menu {
    text-align: left;
  }
</style>
