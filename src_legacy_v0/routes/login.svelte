<script>
  import Auth from "supabase-ui-svelte";

  import { user } from "$lib/stores";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/db";
</script>

<div class="auth_wrapper">
  <Auth
    supabaseClient={supabase}
    providers={["google", "github", "twitter"]}
    socialLayout={"horizontal"}
  />
</div>

<style>
  .auth_wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    max-width: 400px;
    margin: 0 auto;
  }
</style>
