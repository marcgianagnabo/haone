<script lang="ts">
  import AppShell from "$components/nav/AppShell.svelte";
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { globalDialog } from "$state/dialog.svelte";
  import { authTrail } from "$utils/auth-trail";

  let { children } = $props();

  const isLoading = $derived(
    (!auth.accessToken && page.url.pathname !== "/sign-in") || auth.authType !== "admin"
  );

  // Redirect logic
  $effect(() => {
    if (auth.accessToken) {
      if (auth.authType !== "admin") {
        if (auth.isInstanceAdmin) {
          auth.signOut();
          auth.redirectTo = page.url.pathname + page.url.search;
          globalDialog.show(
            "Access Denied",
            "Instance administrator accounts must sign in as a House Council Officer."
          );
          authTrail("guard:/sign-in from:admin-layout");
          goto("/sign-in");
          return;
        }
        authTrail("guard:/resident from:admin-layout");
        goto("/resident");
      }
      return;
    }

    // Save path for restoration
    auth.redirectTo = page.url.pathname + page.url.search;
    authTrail("guard:/sign-in from:admin-layout");
    goto("/sign-in");
  });
</script>

<AppShell {isLoading}>
  {@render children()}
</AppShell>
