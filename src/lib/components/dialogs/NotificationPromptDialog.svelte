<script lang="ts">
  import { ResponsiveDialog } from "$ui/haone";
  import { Button } from "$ui/button";
  import { Bell, BellRing, Settings } from "@lucide/svelte";
  import { NOTIF_PROMPT_DISMISSED_KEY, notifications } from "$state/notifications.svelte";
  import { PUBLIC_VAPID_PUBLIC_KEY } from "$env/static/public";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let isDialogOpen = $state(false);
  // "ask" -> Allow / Not now. "info" -> denied: find it in Settings + Done.
  let step = $state<"ask" | "info">("ask");
  let isWorking = $state(false);
  let errorMsg = $state<string | null>(null);
  let unlocked = $state(false);

  function rememberDismissal() {
    try {
      localStorage.setItem(NOTIF_PROMPT_DISMISSED_KEY, String(Date.now()));
    } catch {
      /* persistence unavailable */
    }
  }

  function clearDismissal() {
    try {
      localStorage.removeItem(NOTIF_PROMPT_DISMISSED_KEY);
    } catch {
      /* noop */
    }
  }

  export function open() {
    notifications.refreshStatus();
    step = notifications.permission === "denied" ? "info" : "ask";
    unlocked = false;
    isWorking = false;
    errorMsg = null;
    isDialogOpen = true;
  }

  export function close() {
    unlocked = true;
    isDialogOpen = false;
  }

  function dismissRespectfully() {
    rememberDismissal();
    close();
  }

  function handleOpenChange(next: boolean) {
    if (!next && !unlocked) {
      // Respect overlay click / Escape as "not now" — never force.
      dismissRespectfully();
      return;
    }
    isDialogOpen = next;
  }

  async function handleAllow() {
    if (isWorking) return;
    isWorking = true;
    errorMsg = null;
    try {
      const granted = await notifications.requestPermission();
      if (!granted) {
        if (notifications.permission === "denied") {
          step = "info";
        } else {
          errorMsg = "Browser dismissed the prompt — click Allow again to retry.";
        }
        return;
      }
      if (!PUBLIC_VAPID_PUBLIC_KEY) {
        toast.error("Notification system not configured (VAPID key missing)");
        step = "info";
        return;
      }
      const ok = await notifications.subscribe(PUBLIC_VAPID_PUBLIC_KEY);
      if (ok) {
        clearDismissal();
        close();
      } else {
        errorMsg = "Couldn't enable notifications — click Allow again to retry.";
      }
    } finally {
      isWorking = false;
    }
  }

  function handleNotNow() {
    dismissRespectfully();
  }

  function handleGoToSettings() {
    close();
    goto("/resident/settings");
  }
</script>

<ResponsiveDialog.Root bind:open={isDialogOpen} onOpenChange={handleOpenChange}>
  <ResponsiveDialog.Content
    showCloseButton={false}
    class="max-h-[calc(100dvh-2rem)] overflow-y-auto"
  >
    <ResponsiveDialog.Header>
      <ResponsiveDialog.Title>
        {step === "ask" ? "Stay updated" : "Notifications live in Settings"}
      </ResponsiveDialog.Title>
    </ResponsiveDialog.Header>
    <div class="space-y-4 px-4 pb-4 md:px-0">
      {#if step === "ask"}
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <BellRing class="h-5 w-5 text-brand" />
          </div>
          <p class="text-sm leading-relaxed text-muted-foreground">
            Allow push notifications to receive alerts for laundry reminders and hall announcements.
            You can change this anytime later.
          </p>
        </div>
        {#if errorMsg}
          <p class="text-sm leading-relaxed text-destructive">{errorMsg}</p>
        {/if}
      {:else}
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Bell class="h-5 w-5 text-muted-foreground" />
          </div>
          <p class="text-sm leading-relaxed text-muted-foreground">
            No problem — push notifications stay off. You can turn them on anytime in
            <strong class="font-semibold text-foreground">Settings → Notifications</strong>.
          </p>
        </div>
      {/if}
    </div>
    <ResponsiveDialog.Footer class="flex flex-col gap-2 sm:flex-col">
      {#if step === "ask"}
        <Button variant="outline" class="w-full" disabled={isWorking} onclick={handleNotNow}>
          Not now
        </Button>
        <Button class="w-full" disabled={isWorking} isLoading={isWorking} onclick={handleAllow}>
          Allow notifications
        </Button>
      {:else}
        <Button variant="outline" class="w-full" disabled={isWorking} onclick={dismissRespectfully}>Done</Button>
        <Button class="w-full" disabled={isWorking} icon={Settings} onclick={handleGoToSettings}>
          Open Settings
        </Button>
      {/if}
    </ResponsiveDialog.Footer>
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
