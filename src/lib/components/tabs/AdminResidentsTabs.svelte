<script lang="ts">
  import { goto } from "$app/navigation";
  import * as Tabs from "$ui/tabs";
  import { settings } from "$state/settings.svelte";
  import { syncCount } from "$state/sync-count.svelte";
  import { List, Bed, BookUser, ArrowRightLeft } from "@lucide/svelte";

  let {
    active = "list"
  }: {
    active?: "list" | "rooms" | "officers" | "sync";
  } = $props();

  // The active term arrives asynchronously from the root layout's settings
  // sync, so depend on it: this retries until it exists (and stays a no-op
  // after the one successful load) instead of silently missing the badge on
  // a cold page load.
  $effect(() => {
    const term = settings.activeTerm;
    if (term) {
      syncCount.load();
    }
  });

  function handleTabChange(value: string) {
    if (value === "list") {
      goto("/admin/residents");
    } else if (value === "rooms") {
      goto("/admin/residents/rooms");
    } else if (value === "officers") {
      goto("/admin/residents/officers");
    } else if (value === "sync") {
      goto("/admin/residents/sync");
    }
  }
</script>

<Tabs.Root value={active} onValueChange={handleTabChange}>
  <Tabs.List>
    <Tabs.Trigger value="list" class="flex items-center gap-1.5">
      <List class="h-3.5 w-3.5" />
      List
    </Tabs.Trigger>
    <Tabs.Trigger value="rooms" class="flex items-center gap-1.5">
      <Bed class="h-3.5 w-3.5" />
      Rooms
    </Tabs.Trigger>
    <Tabs.Trigger value="officers" class="flex items-center gap-1.5">
      <BookUser class="h-3.5 w-3.5" />
      Officers
    </Tabs.Trigger>
    <Tabs.Trigger value="sync" class="relative flex items-center gap-1.5">
      <ArrowRightLeft class="h-3.5 w-3.5" />
      Sync
      {#if syncCount.count > 0}
        <span
          class="pointer-events-none ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground tabular-nums"
          title="{syncCount.count} resident{syncCount.count === 1 ? '' : 's'} pending sync"
        >
          {syncCount.count > 99 ? "99+" : syncCount.count}
        </span>
      {/if}
    </Tabs.Trigger>
  </Tabs.List>
</Tabs.Root>
