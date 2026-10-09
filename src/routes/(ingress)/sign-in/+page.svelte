<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { LoaderCircleIcon } from "@lucide/svelte";
  import { replaceState } from "$app/navigation";
  import BrandingLogo from "$components/branding/BrandingLogo.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { fade, fly } from "svelte/transition";

  let isSigningIn = $state(false);
  let isLoadingAuth = $state(true);
  let rememberMe = $state(true);

  onMount(async () => {
    pageState.title = "Sign In";
    if (window.location.search.includes("code=")) {
      isSigningIn = true;
    }
    let redirecting = false;
    try {
      redirecting = await auth.handleCallback(rememberMe);
    } catch (e: any) {
      globalDialog.show("Sign-in Failed", e.message || "An unexpected error occurred.");
    } finally {
      if (!redirecting) {
        isSigningIn = false;
        replaceState(window.location.pathname, {});
        isLoadingAuth = false;
      }
    }
  });

  async function handleLogin() {
    isSigningIn = true;
    await auth.signIn("resident");
  }
</script>

<div class="flex flex-col items-center justify-center">
  <div class="relative z-10 w-full max-w-sm space-y-6">
    <div class="flex flex-col items-center space-y-8 text-center">
      <BrandingLogo class="h-28 w-auto" />
    </div>

    <div in:fly={{ y: 16, duration: 500 }} class="grid pt-6">
      {#if isSigningIn || isLoadingAuth}
        <div
          transition:fade={{ duration: 250 }}
          class="col-start-1 row-start-1 flex h-30 items-center justify-center"
        >
          <LoaderCircleIcon class="h-5 w-5 animate-spin text-foreground" />
        </div>
      {:else}
        <div transition:fade={{ duration: 300 }} class="col-start-1 row-start-1 space-y-3">
          <Button
            onclick={handleLogin}
            class="h-14 w-full rounded-xl bg-foreground text-base font-bold text-background transition-opacity hover:opacity-90"
          >
            Sign In
          </Button>

          <p class="pt-1 text-center text-xs text-muted-foreground">
            House Council officers can choose their workspace after signing in.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: var(--background);
  }
</style>
