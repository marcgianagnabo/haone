<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { Toaster } from "$ui/sonner";
  import { ModeWatcher } from "mode-watcher";
  import "./layout.css";
  import favicon from "$assets/favicon.svg";

  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { settings } from "$state/settings.svelte";
  import { features } from "$state/features.svelte";
  import { setMode, resetMode } from "mode-watcher";
  import UIProvider from "$components/UIProvider.svelte";
  import GlobalAlertDialog from "$components/forms/GlobalAlertDialog.svelte";
  import { brandingState } from "$state/branding.svelte";

  let { children } = $props();

  onMount(async () => {
    // Service Worker Registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }
  });

  $effect(() => {
    if (!auth.accessToken) {
      return;
    }
    features.load();
    try {
      settings.syncFromServer().then(() => {
        if (settings.theme === "system") {
          resetMode();
        } else {
          setMode(settings.theme as any);
        }
      });
    } catch (e) {
      console.error("Failed to sync settings:", e);
    }
  });

  function getEffectiveTitle(): string {
    let title = pageState.title;
    if (title !== "") {
      title += " - ";
    }
    title += `HAOne for ${brandingState.profile.name}`;
    return title;
  }
</script>

<ModeWatcher />
<Toaster mobileOffset="100px" />

<svelte:head>
  <title>{getEffectiveTitle()}</title>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<UIProvider class="flex min-h-screen flex-col">
  {@render children()}
  <GlobalAlertDialog />
</UIProvider>
