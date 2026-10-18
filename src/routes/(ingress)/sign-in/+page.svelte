<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { LoaderCircleIcon, ShieldCheckIcon } from "@lucide/svelte";
  import { replaceState } from "$app/navigation";
  import BrandingLogo from "$components/branding/BrandingLogo.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { fade, fly } from "svelte/transition";
  import { authTrail } from "$utils/auth-trail";

  let isSigningIn = $state(false);
  let isLoadingAuth = $state(true);
  let rememberMe = $state(true);
  let callbackHandled = false;
  let lastError = $state<string | null>(null);
  // "View other options" swaps in place for the House Council sign-in, which
  // requests the wider admin scope set on the next Google round-trip.
  let isHouseCouncilRevealed = $state(false);

  function dismissLastError() {
    lastError = null;
    try {
      localStorage.removeItem("halsk.last_error");
      localStorage.removeItem("halsk.last_raw_error");
    } catch {
      /* noop */
    }
  }

  onMount(async () => {
    pageState.title = "Sign In";
    try {
      const raw = localStorage.getItem("halsk.last_error");
      if (raw) {
        const parsed = JSON.parse(raw);
        lastError =
          `Status: ${parsed.status ?? ""}\n` +
          (parsed.raw ? `Raw: ${parsed.raw}\n` : "") +
          `Path: ${parsed.path ?? ""}\n` +
          `Time: ${parsed.time ?? ""}\n` +
          `Build: ${parsed.build ?? ""}\n` +
          `Auth trail: ${parsed.trail ?? ""}`;
      }
    } catch {
      /* diagnostics are best-effort */
    }
    if (callbackHandled) {
      return;
    }
    callbackHandled = true;
    if (window.location.search.includes("code=")) {
      isSigningIn = true;
    }
    let redirecting = false;
    try {
      redirecting = await auth.handleCallback(rememberMe);
    } catch (e: any) {
      // Never let callback failures reach the SvelteKit error boundary
      // (+error.svelte 404/500). Stay on /sign-in with an actionable dialog.
      // Query params are already stripped by exchangeAuthCode, so reload is safe.
      authTrail(`callback_error:${(e.message || "unknown").slice(0, 60)}`);
      globalDialog.show("Sign-in Failed", e.message || "An unexpected error occurred.");
    } finally {
      if (!redirecting) {
        isSigningIn = false;
        try {
          replaceState(window.location.pathname, {});
        } catch {
          /* noop */
        }
        isLoadingAuth = false;
      }
    }
  });

  async function handleLogin() {
    dismissLastError();
    isSigningIn = true;
    await auth.signIn("resident");
  }

  async function handleOtherOptions() {
    if (!isHouseCouncilRevealed) {
      isHouseCouncilRevealed = true;
      return;
    }
    dismissLastError();
    isSigningIn = true;
    await auth.signIn("admin");
  }
</script>

<div class="flex flex-col items-center justify-center">
  <div
    class="relative z-10 w-full max-w-sm space-y-6 rounded-2xl bg-transparent p-6 shadow-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
  >
    <div class="flex flex-col items-center space-y-8 text-center">
      <div class="md:hidden">
        <BrandingLogo mode="dark" class="h-28 w-auto" />
      </div>
      <div class="hidden md:block">
        <BrandingLogo class="h-28 w-auto" />
      </div>
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
          <Button
            variant="link"
            size="sm"
            class="h-auto w-full justify-center text-xs font-semibold text-muted-foreground"
            onclick={handleOtherOptions}
            icon={isHouseCouncilRevealed ? ShieldCheckIcon : undefined}
          >
            {isHouseCouncilRevealed ? "Sign in as House Council" : "View other options"}
          </Button>
          {#if lastError}
            <div class="rounded-xl border bg-muted/30 p-3 text-left">
              <p class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Last error on this device
              </p>
              <pre
                class="mt-1 max-h-40 overflow-auto font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground">{lastError}</pre>
              <Button
                variant="ghost"
                size="sm"
                class="mt-2 h-7 w-full text-xs tracking-widest uppercase"
                onclick={dismissLastError}
              >
                Dismiss
              </Button>
            </div>
          {/if}
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
