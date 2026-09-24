<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import {
    LayoutDashboard,
    Settings,
    Users,
    ChartPie,
    Mail,
    HandCoins,
    RotateCcwClock,
    GraduationCap,
    Contact,
    WashingMachine,
    Megaphone,
    Trophy,
    ListOrdered,
    Database,
    Refrigerator,
    Wallet,
    House,
    Banknote,
    BookUser,
    CirclePlus,
    X,
    CircleUserIcon,
    LogOutIcon
  } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import { dev } from "$app/environment";
  import { auth } from "$state/auth.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { features } from "$state/features.svelte";
  import { page } from "$app/state";
  import { isResidentRouteAllowed } from "$api/controllers/resident-controller";
  import { getCustomServices } from "$lib/services";
  import { AccountType } from "$lib/types";
  import { namecase } from "@compwright/namecase";
  import { env } from "$env/dynamic/public";

  const sidebar = Sidebar.useSidebar();

  const isAdminView = $derived(page.url.pathname.startsWith("/admin"));
  let imgError = $state(false);

  // --- Admin Navigation Items ---
  const adminMgmtItems = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Financial Report", url: "/admin/financial-report", icon: HandCoins },
    { title: "Transactions", url: "/admin/transactions", icon: RotateCcwClock },
    { title: "Residents", url: "/admin/residents", icon: Users },
    { title: "Users", url: "/admin/users", icon: Contact },
    { title: "Demographics", url: "/admin/demographics", icon: ChartPie },
    { title: "Academic Terms", url: "/admin/academic-terms", icon: GraduationCap }
  ];

  const adminServiceItems = $derived([
    { title: "Laundry", url: "/admin/laundry", icon: WashingMachine },
    { title: "Fridge", url: "/admin/fridge", icon: Refrigerator },
    { title: "Announcements", url: "/admin/announcements", icon: Megaphone },
    ...(features.achievementsEnabled
      ? [
          { title: "Achievements", url: "/admin/achievements", icon: Trophy },
          { title: "Leaderboards", url: "/admin/leaderboards", icon: ListOrdered }
        ]
      : []),
    ...getCustomServices("admin")
  ]);

  const adminSecondaryItems = $derived(
    [
      {
        title: "Resident View",
        url: "/resident",
        icon: LayoutDashboard,
        hide: auth.isInstanceAdmin
      },
      {
        title: "Email Dispatcher",
        url: "/admin/email-dispatcher",
        icon: Mail
      },
      {
        title: "Database Sync",
        url: "/admin/database-sync",
        icon: Database,
        hide: !dev || env.PUBLIC_DB_PROVIDER !== "supabase"
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings
      }
    ].filter((i) => !i.hide)
  );

  // --- Resident Navigation Items ---
  const residentMgmtItems = [
    { title: "Dashboard", url: "/resident", icon: LayoutDashboard },
    { title: "Finance", url: "/resident/finance", icon: Wallet },
    { title: "Occupancy", url: "/resident/occupancy", icon: House }
  ];

  const residentServiceItems = $derived([
    { title: "Laundry", url: "/resident/laundry", icon: WashingMachine },
    { title: "Fridge", url: "/resident/fridge", icon: Refrigerator },
    { title: "Payment Requests", url: "/resident/payment-requests", icon: Banknote },
    ...getCustomServices("resident"),
    { title: "Announcements", url: "/resident/announcements", icon: Megaphone },
    ...(features.achievementsEnabled
      ? [
          { title: "Achievements", url: "/resident/achievements", icon: Trophy },
          { title: "Leaderboards", url: "/resident/leaderboards", icon: ListOrdered }
        ]
      : []),
    { title: "Officers", url: "/resident/officers", icon: BookUser }
  ]);

  const isAlum = $derived(residentState.status?.currEntry?.accountType === AccountType.ALUMNUS);

  const filteredResidentServices = $derived.by(() => {
    const type = residentState.status?.account?.type || "";
    const room = residentState.status?.account?.room || "";
    return residentServiceItems.filter((item) => {
      return isResidentRouteAllowed(item.url, type, room);
    });
  });

  const residentSecondaryItems = $derived.by(() => {
    const items = [
      {
        title: "Settings",
        url: "/resident/settings",
        icon: Settings
      }
    ];
    if (auth.authType === "admin") {
      items.unshift({
        title: "Admin View",
        url: "/admin",
        icon: House
      });
    }
    return items;
  });

  // Active items by view
  const mgmtItems = $derived(isAdminView ? adminMgmtItems : residentMgmtItems);
  const serviceItems = $derived(isAdminView ? adminServiceItems : filteredResidentServices);
  const secondaryItems = $derived(isAdminView ? adminSecondaryItems : residentSecondaryItems);
</script>

<Sidebar.Root collapsible="icon" class="data-[mobile=true]:w-full!">
  {#if sidebar.isMobile && auth.user}
    <Sidebar.Header class="shrink-0 p-0">
      <div class="flex shrink-0 items-center justify-end px-4 py-3">
        <Button
          variant="ghost"
          size="icon-lg"
          class="size-10 shrink-0 [&_svg]:size-6"
          onclick={() => sidebar.setOpenMobile(false)}
          icon={X}
        />
      </div>
    </Sidebar.Header>
  {/if}

  <Sidebar.Content>
    {#if sidebar.isMobile && auth.user}
      <div class="flex flex-col gap-6 px-4 pt-6">
        <div class="flex flex-col items-center justify-center gap-3 text-center">
          {#if !imgError}
            <img
              src={auth.avatarUrl}
              alt={namecase(auth.displayName)}
              class="h-32 w-32 rounded-full object-cover"
              onerror={() => (imgError = true)}
            />
          {:else}
            <CircleUserIcon class="h-32 w-32 text-foreground" />
          {/if}

          <h2 class="mt-1 text-2xl font-normal tracking-normal text-foreground">
            Hi, {namecase(auth.preferredName)}!
          </h2>

          <button
            onclick={() => auth.signOut()}
            class="mt-1 flex items-center gap-2 rounded-full border border-border px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <LogOutIcon class="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
      <Sidebar.Group class="mt-auto">
        <Sidebar.Menu>
          {#each secondaryItems as item}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                size="lg"
                isActive={page.url.pathname === item.url}
                onclick={() => sidebar.setOpenMobile(false)}
              >
                {#snippet child({ props })}
                  <a href={item.url} {...props} onclick={() => sidebar.setOpenMobile(false)}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.Group>
    {/if}
    <Sidebar.Group>
      <Sidebar.GroupLabel>Management</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each mgmtItems as item}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              isActive={page.url.pathname === item.url}
              onclick={() => sidebar.setOpenMobile(false)}
            >
              {#snippet child({ props })}
                <a href={item.url} {...props} onclick={() => sidebar.setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
        {#if !isAdminView && isAlum}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              onclick={() => {
                sidebar.setOpenMobile(false);
                residentState.forceOnboarding = true;
              }}
            >
              <CirclePlus />
              <span>Check In</span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/if}
      </Sidebar.Menu>
    </Sidebar.Group>

    <Sidebar.Group>
      <Sidebar.GroupLabel>Services</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each serviceItems as item}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              isActive={page.url.pathname === item.url}
              onclick={() => sidebar.setOpenMobile(false)}
            >
              {#snippet child({ props })}
                <a href={item.url} {...props} onclick={() => sidebar.setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
      </Sidebar.Menu>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
