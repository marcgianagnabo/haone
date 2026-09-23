<script lang="ts">
  import OnboardingForm from "./OnboardingForm.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { auth } from "$state/auth.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import { LoaderCircleIcon } from "@lucide/svelte";
  import { namecase } from "@compwright/namecase";

  let isChecking = $state(true);

  const residentName = $derived.by(() => {
    const profile = residentState.status?.profile;
    const curr = residentState.status?.currEntry;
    const raw =
      profile?.overrideName ||
      profile?.firstName ||
      curr?.overrideName ||
      curr?.firstName ||
      auth.user?.overrideName ||
      auth.user?.firstName ||
      "";
    return namecase(raw.trim());
  });

  onMount(async () => {
    pageState.title = "Onboarding";
    if (!auth.accessToken) {
      goto("/sign-in");
      return;
    }

    if (!residentState.status) {
      await residentState.refresh();
    }

    if (!residentState.needsOnboarding && !residentState.forceOnboarding) {
      goto("/resident");
      return;
    }

    isChecking = false;
  });

  async function handleSuccess() {
    await residentState.refresh();
    if (residentState.error) {
      throw new Error(residentState.error);
    }
    if (!residentState.needsOnboarding) {
      goto("/resident");
    }
  }
</script>

{#if isChecking || !residentState.status}
  <div class="flex items-center justify-center py-12">
    <LoaderCircleIcon class="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
{:else}
  <div class="w-full space-y-6">
    <div class="space-y-2 text-center md:text-left">
      <h1 class="font-['Archivo'] text-2xl font-black tracking-tight text-foreground sm:text-3xl">
        {#if residentName}Welcome, {residentName}{:else}Onboarding{/if}
      </h1>
      <p class="text-sm text-muted-foreground">
        Complete the steps below to register for residency.
      </p>
    </div>

    <OnboardingForm status={residentState.status} onSuccess={handleSuccess} />

    <div class="pt-4 text-center">
      <p class="text-xs text-muted-foreground">
        If you believe this is an error, please contact the administrator via
        <a
          href="mailto:{brandingState.profile.replyTo}"
          class="font-bold text-brand hover:underline"
        >
          email
        </a>.
      </p>
    </div>
  </div>
{/if}
