<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { LayoutDashboard, ShieldCheck, LogOut } from "@lucide/svelte";
  import BrandingLogo from "$components/branding/BrandingLogo.svelte";
  import { goto } from "$app/navigation";
  import { pageState } from "$state/page-info.svelte";
  import { fade, fly } from "svelte/transition";

  onMount(() => {
    pageState.title = "Choose Workspace";
    // No session (e.g. direct URL access or reload without remember-me):
    // there is no pending choice to make.
    if (!auth.accessToken || !auth.user) {
      goto("/sign-in");
      return;
    }
    if (!auth.workspaceChoiceRequired) {
      goto(auth.authType === "admin" ? "/admin" : "/resident");
    }
  });

  async function chooseResident() {
    const target = auth.pendingWorkspaceTarget || "/resident";
    auth.clearWorkspaceChoice();
    await goto(target);
  }

  async function chooseAdmin() {
    auth.clearWorkspaceChoice();
    await auth.signIn("admin");
  }

  async function useDifferentAccount() {
    auth.signOut();
    await goto("/sign-in");
  }
</script>

<div class="flex flex-col items-center justify-center">
  <div class="relative z-10 w-full max-w-sm space-y-6">
    <div class="flex flex-col items-center space-y-8 text-center">
      <BrandingLogo class="h-28 w-auto" />
    </div>

    <div in:fly={{ y: 16, duration: 500 }} class="grid pt-6">
      <div transition:fade={{ duration: 300 }} class="col-start-1 row-start-1 space-y-3">
        {#if auth.user}
          <div class="flex flex-col items-center gap-1 text-center">
            {#if auth.avatarUrl}
              <img
                src={auth.avatarUrl}
                alt={auth.displayName}
                class="h-12 w-12 rounded-full object-cover"
              />
            {/if}
            <p class="text-sm font-bold">{auth.displayName}</p>
            <p class="text-xs text-muted-foreground">{auth.user.email}</p>
            <p class="pt-1 text-xs font-semibold text-primary">
              Signed in as House Council — choose where to go
            </p>
          </div>

          <Button
            onclick={chooseResident}
            class="h-14 w-full rounded-xl bg-foreground text-base font-bold text-background transition-opacity hover:opacity-90"
            icon={LayoutDashboard}
          >
            Resident View
          </Button>

          <Button
            onclick={chooseAdmin}
            variant="outline"
            class="h-14 w-full rounded-xl text-base font-bold"
            icon={ShieldCheck}
          >
            House Council Admin
          </Button>

          <Button
            variant="ghost"
            onclick={useDifferentAccount}
            class="h-10 w-full rounded-xl text-xs font-bold text-muted-foreground"
            icon={LogOut}
          >
            Use a different account
          </Button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: var(--background);
  }
</style>
