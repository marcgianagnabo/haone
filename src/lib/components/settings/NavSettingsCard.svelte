<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import {
    LayoutDashboard,
    Wallet,
    House,
    WashingMachine,
    Banknote,
    Megaphone,
    Trophy,
    ListOrdered,
    Users,
    Bed,
    Contact,
    GraduationCap,
    Mail,
    Settings,
    History,
    Receipt,
    HandCoins,
    ChartPie,
    ChevronUp,
    ChevronDown,
    X
  } from "@lucide/svelte";
  import { settings } from "$state/settings.svelte";
  import { features } from "$state/features.svelte";
  import { page } from "$app/state";

  const isAdminView = $derived(page.url.pathname.startsWith("/admin"));

  const ALL_RESIDENT_ITEMS = $derived(
    [
      { id: "home", label: "Home", icon: LayoutDashboard },
      { id: "finance", label: "Finance", icon: Wallet },
      { id: "occupancy", label: "Occupancy", icon: House },
      { id: "laundry", label: "Laundry", icon: WashingMachine },
      { id: "payments", label: "Payments", icon: Banknote },
      { id: "news", label: "News", icon: Megaphone },
      { id: "achievements", label: "Trophy", icon: Trophy },
      { id: "leaderboards", label: "Ranks", icon: ListOrdered }
    ].filter((item) => {
      if (features.achievementsEnabled) {
        return true;
      }
      return item.id !== "achievements" && item.id !== "leaderboards";
    })
  );

  const ALL_ADMIN_ITEMS = $derived(
    [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "pending", label: "Pending", icon: Receipt },
      { id: "history", label: "History", icon: History },
      { id: "residents", label: "Residents", icon: Users },
      { id: "rooms", label: "Rooms", icon: Bed },
      { id: "users", label: "Users", icon: Contact },
      { id: "financial", label: "Financial", icon: HandCoins },
      { id: "demographics", label: "Demographics", icon: ChartPie },
      { id: "terms", label: "Terms", icon: GraduationCap },
      { id: "dispatcher", label: "Email", icon: Mail },
      { id: "settings", label: "Settings", icon: Settings },
      { id: "laundry", label: "Laundry", icon: WashingMachine },
      { id: "payments", label: "Payments", icon: Banknote },
      { id: "news", label: "News", icon: Megaphone },
      { id: "achievements", label: "Trophy", icon: Trophy },
      { id: "leaderboards", label: "Ranks", icon: ListOrdered }
    ].filter((item) => {
      if (features.achievementsEnabled) {
        return true;
      }
      return item.id !== "achievements" && item.id !== "leaderboards";
    })
  );

  function toggleItem(list: string[], id: string) {
    if (list.includes(id)) {
      return list.filter((i) => i !== id);
    }
    if (list.length >= 4) return list;
    return [...list, id];
  }

  function moveItem(list: string[], index: number, direction: number) {
    const newList = [...list];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newList.length) return newList;
    const [moved] = newList.splice(index, 1);
    newList.splice(newIndex, 0, moved);
    return newList;
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Mobile Navigation</Card.Title>
    <Card.Description>Customize your mobile bottom navigation bar.</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-8">
    {#if !isAdminView}
      <!-- Resident Nav -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Resident Navigation
          </h4>
          <span class="text-xs text-muted-foreground"
            >{settings.residentNavIds.length} / 4 items</span
          >
        </div>

        <div class="flex min-h-13 flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
          {#each settings.residentNavIds as itemId, i}
            {@const item = ALL_RESIDENT_ITEMS.find((it) => it.id === itemId)}
            {#if item}
              <Badge variant="secondary" class="flex items-center gap-1.5 px-2.5 py-1 text-sm">
                <item.icon class="h-3.5 w-3.5" />
                {item.label}
                <div class="ml-1 flex items-center gap-0.5 border-l pl-1">
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() =>
                      (settings.residentNavIds = moveItem(settings.residentNavIds, i, -1))}
                    disabled={i === 0}
                  >
                    <ChevronUp class="h-3 w-3" />
                  </button>
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() =>
                      (settings.residentNavIds = moveItem(settings.residentNavIds, i, 1))}
                    disabled={i === settings.residentNavIds.length - 1}
                  >
                    <ChevronDown class="h-3 w-3" />
                  </button>
                  <button
                    class="ml-0.5 hover:text-destructive"
                    onclick={() =>
                      (settings.residentNavIds = settings.residentNavIds.filter(
                        (id) => id !== itemId
                      ))}
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              </Badge>
            {/if}
          {/each}
          {#if settings.residentNavIds.length === 0}
            <span class="py-1 text-sm text-muted-foreground italic">No items selected.</span>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          {#each ALL_RESIDENT_ITEMS as item}
            {@const selected = settings.residentNavIds.includes(item.id)}
            <Button
              variant={selected ? "default" : "outline"}
              size="sm"
              class="h-8 gap-1.5"
              onclick={() =>
                (settings.residentNavIds = toggleItem(settings.residentNavIds, item.id))}
              disabled={!selected && settings.residentNavIds.length >= 4}
              icon={item.icon}
            >
              {item.label}
            </Button>
          {/each}
        </div>
      </div>
    {/if}

    {#if isAdminView}
      <!-- Admin Nav -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Admin Navigation
          </h4>
          <span class="text-xs text-muted-foreground">{settings.adminNavIds.length} / 4 items</span>
        </div>

        <div class="flex min-h-13 flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
          {#each settings.adminNavIds as itemId, i}
            {@const item = ALL_ADMIN_ITEMS.find((it) => it.id === itemId)}
            {#if item}
              <Badge variant="secondary" class="flex items-center gap-1.5 px-2.5 py-1 text-sm">
                <item.icon class="h-3.5 w-3.5" />
                {item.label}
                <div class="ml-1 flex items-center gap-0.5 border-l pl-1">
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() => (settings.adminNavIds = moveItem(settings.adminNavIds, i, -1))}
                    disabled={i === 0}
                  >
                    <ChevronUp class="h-3 w-3" />
                  </button>
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() => (settings.adminNavIds = moveItem(settings.adminNavIds, i, 1))}
                    disabled={i === settings.adminNavIds.length - 1}
                  >
                    <ChevronDown class="h-3 w-3" />
                  </button>
                  <button
                    class="ml-0.5 hover:text-destructive"
                    onclick={() =>
                      (settings.adminNavIds = settings.adminNavIds.filter((id) => id !== itemId))}
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              </Badge>
            {/if}
          {/each}
          {#if settings.adminNavIds.length === 0}
            <span class="py-1 text-sm text-muted-foreground italic">No items selected.</span>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          {#each ALL_ADMIN_ITEMS as item}
            {@const selected = settings.adminNavIds.includes(item.id)}
            <Button
              variant={selected ? "default" : "outline"}
              size="sm"
              class="h-8 gap-1.5"
              onclick={() => (settings.adminNavIds = toggleItem(settings.adminNavIds, item.id))}
              disabled={!selected && settings.adminNavIds.length >= 4}
              icon={item.icon}
            >
              {item.label}
            </Button>
          {/each}
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
