<script lang="ts">
  import { ResponsiveDialog } from "$ui/haone";
  import { Button } from "$ui/button";
  import { Bell, BellRing, Settings } from "@lucide/svelte";
  import { notifications } from "$state/notifications.svelte";
  import { PUBLIC_VAPID_PUBLIC_KEY } from "$env/static/public";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let isDialogOpen = $state(false);
  // "ask" -> Allow / Not now. "info" -> find it in Settings + Done.
  let step = $state<"ask" | "info">("ask");
  let isWorking = $state(false);
  // Only our own buttons may close the dialog; outside click / Escape is
  // bounced back so the prompt cannot be skipped past.
  let unlocked = $state(false);

  export function open() {
    step = notifications.permission === "denied" ? "info" : "ask";
    unlocked = false;
    isWorking = false;
    isDialogOpen = true;
  }

  export function close() {
    unlocked = true;
    isDialogOpen = false;
  }

  function handleOpenChange(next: boolean) {
    if (!next && !unlocked) {
      // Bounce back dismiss attempts (overlay click / Escape / swipe).
      isDialogOpen = true;
      return;
    }
    isDialogOpen = next;
  }

  async function handleAllow() {
    if (isWorking) return;
    isWorking = true;
    try {
      const granted = await notifications.requestPermission();
      if (!granted) {
        step = "info";
        return;
      }
      if (!PUBLIC_VAPID_PUBLIC_KEY) {
        toast.error("Notification system not configured (VAPID key missing)");
        step = "info";
        return;
      }
      await notifications.subscribe(PUBLIC_VAPID_PUBLIC_KEY);
      close();
    } finally {
      isWorking = false;
    }
  }

  function handleNotNow() {
    step = "info";
  }

  function handleGoToSettings() {
    close();
    goto("/resident/settings");
  }
</script>

<ResponsiveDialog.Root bind:open={isDialogOpen} onOpenChange={handleOpenChange}>
  <ResponsiveDialog.Content>
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
    <ResponsiveDialog.Footer class="grid grid-cols-2 gap-2 md:flex">
      {#if step === "ask"}
        <Button variant="outline" class="w-full" disabled={isWorking} onclick={handleNotNow}>
          Not now
        </Button>
        <Button class="w-full" disabled={isWorking} isLoading={isWorking} onclick={handleAllow}>
          Allow notifications
        </Button>
      {:else}
        <Button variant="outline" class="w-full" disabled={isWorking} onclick={close}>Done</Button>
        <Button class="w-full" disabled={isWorking} icon={Settings} onclick={handleGoToSettings}>
          Open Settings
        </Button>
      {/if}
    </ResponsiveDialog.Footer>
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
