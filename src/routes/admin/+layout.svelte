<script lang="ts">
  import AppShell from "$components/nav/AppShell.svelte";
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { globalDialog } from "$state/dialog.svelte";
  import { authTrail, shouldRedirect } from "$utils/auth-trail";

  let { children } = $props();

  const isLoading = $derived(
    (!auth.accessToken && page.url.pathname !== "/sign-in") || auth.authType !== "admin"
  );

  // Bounce-loop tripwire: a resident session that keeps landing on /admin can
  // emit an unbounded chain of redirect effects, and overlapping goto() calls
  // can race the router into a stackless 500. After a few bounces in a short
  // window we stop bouncing and park on /sign-in with an explanation, so the
  // user recovers with a clean sign-in instead of a render loop.
  let bounceCount = 0;
  let bounceWindowStart = 0;
  const BOUNCE_LIMIT = 2;
  const BOUNCE_WINDOW_MS = 30 * 60 * 1000;

  function bounceToResident() {
    const now = Date.now();
    if (now - bounceWindowStart > BOUNCE_WINDOW_MS) {
      bounceWindowStart = now;
      bounceCount = 0;
    }
    bounceCount += 1;
    if (bounceCount > BOUNCE_LIMIT) {
      authTrail("bounce_loop tripwire:/sign-in");
      if (shouldRedirect("/sign-in", 0)) {
        globalDialog.show(
          "Please Sign In Again",
          "We detected repeated redirects on this device. Please sign in again to continue."
        );
        goto("/sign-in");
      }
      return;
    }
    authTrail("guard:/resident from:admin-layout");
    if (shouldRedirect("/resident")) {
      goto("/resident");
    }
  }

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
          if (shouldRedirect("/sign-in", 0)) {
            goto("/sign-in");
          }
          return;
        }
        bounceToResident();
      }
      return;
    }

    // Save path for restoration
    auth.redirectTo = page.url.pathname + page.url.search;
    authTrail("guard:/sign-in from:admin-layout");
    if (shouldRedirect("/sign-in", 0)) {
      goto("/sign-in");
    }
  });
</script>

<AppShell {isLoading}>
  {@render children()}
</AppShell>
