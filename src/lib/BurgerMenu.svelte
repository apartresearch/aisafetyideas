<script>
  import BurgerButton from "./BurgerButton.svelte";
  import SideMenu from "./SideMenu.svelte";
  export let open = false;
  export let duration = 0.4;
  export let width = "100vw";
  export let padding = "25px";
  export let paddingTop = "50px";
  export let backgroundColor = "rgb(1, 0, 74)";
  export let burgerColor = "rgb(18.4, 18.4, 18.4)";
  export let menuColor = "rgb(180, 180, 180)";
  let burgerProps = {
    duration: duration,
    burgerColor: burgerColor,
    menuColor: menuColor,
  };
  let menuProps = {
    duration: duration,
    width: width,
    padding: padding,
    paddingTop: paddingTop,
    backgroundColor: backgroundColor,
    menuColor: menuColor,
  };
</script>

<BurgerButton {...burgerProps} bind:open />

<SideMenu {...menuProps} bind:open>
  <slot />
</SideMenu>
