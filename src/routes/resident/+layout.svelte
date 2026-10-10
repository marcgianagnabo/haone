<script lang="ts">
  import AppShell from "$components/nav/AppShell.svelte";
  import { auth } from "$state/auth.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { isResidentRouteAllowed } from "$api/controllers/resident-controller";

  let { children } = $props();
  let isLoadingAuth = $state(true);

  // While the status is unresolved — or while a needs-onboarding user is
  // awaiting the redirect to /onboarding — keep the fullscreen loader up and
  // never paint the resident views underneath.
  const isLoading = $derived(
    isLoadingAuth ||
      (auth.accessToken && !residentState.status) ||
      (!auth.accessToken && page.url.pathname !== "/sign-in") ||
      !!residentState.needsOnboarding
  );

  const canShowChildren = $derived(
    !!auth.accessToken && !!residentState.status && !residentState.needsOnboarding
  );

  onMount(async () => {
    isLoadingAuth = false;
    if (auth.accessToken) {
      await residentState.refresh();
    }
  });

  // Redirect logic
  $effect(() => {
    const pathname = page.url.pathname as string;
    const isSignInPage = pathname === "/sign-in";

    if (!auth.accessToken && !isSignInPage) {
      auth.redirectTo = page.url.pathname + page.url.search;
      goto("/sign-in");
      return;
    }

    if (auth.accessToken) {
      if (auth.isInstanceAdmin && pathname.startsWith("/resident")) {
        goto("/admin");
        return;
      }

      if (residentState.status) {
        if (residentState.needsOnboarding) {
          goto("/onboarding");
          return;
        }

        const accountType =
          residentState.status?.account?.type || residentState.status?.currEntry?.accountType || "";
        const room = residentState.status?.account?.room || "";
        if (!isResidentRouteAllowed(pathname, accountType, room)) {
          goto("/resident");
          return;
        }
      }
    }
  });
</script>

<AppShell {isLoading}>
  {#if canShowChildren}
    {@render children()}
  {/if}
</AppShell>
