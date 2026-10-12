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
  import { pwaInstall } from "$state/pwa-install.svelte";
  import { sessionTimeout } from "$state/session-timeout.svelte";

  let { children } = $props();

  onMount(async () => {
    pwaInstall.init();
    sessionTimeout.init();
    // One-shot stale-chunk recovery: if a client-side navigation fails to
    // load its JS chunk (common right after a deploy, esp. on WebKit), a
    // single full reload fetches fresh chunks instead of stranding the user
    // on +error.svelte. Guarded so it can never loop.
    const chunkReloaded = (() => {
      try {
        return sessionStorage.getItem("halsk.chunk_reloaded") === "1";
      } catch {
        return true;
      }
    })();
    // Clear the flag once this load proves healthy: a chunk failure before
    // then keeps the flag and shows the error page instead of looping.
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem("halsk.chunk_reloaded");
      } catch {
        /* noop */
      }
    }, 5000);
    const isChunkError = (message: string) =>
      /failed to fetch dynamically imported module|importing a module script failed|loading chunk \d+ failed/i.test(
        message
      );
    const recoverChunk = () => {
      if (chunkReloaded) return;
      try {
        sessionStorage.setItem("halsk.chunk_reloaded", "1");
      } catch {
        return;
      }
      window.location.reload();
    };
    window.addEventListener("error", (e) => {
      if (isChunkError(e.message || "")) recoverChunk();
    });
    window.addEventListener("unhandledrejection", (e) => {
      const msg = (e.reason as Error)?.message || String(e.reason || "");
      if (isChunkError(msg)) {
        e.preventDefault();
        recoverChunk();
      }
    });
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

  $effect(() => {
    // A (new) session counts as activity so the inactivity clock starts here.
    // Kept separate so unrelated state changes never reset the idle timer.
    if (auth.accessToken) {
      sessionTimeout.recordActivity();
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
  <link rel="apple-touch-icon" href="/icon-180x180.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
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
