<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import * as Popover from "$ui/popover";
  import { auth } from "$state/auth.svelte";
  import {
    CircleUser,
    LogOut,
    LayoutDashboard,
    Mail,
    Settings,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon
  } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import { page } from "$app/state";
  import BrandingLogo from "$components/branding/BrandingLogo.svelte";
  import { namecase } from "@compwright/namecase";
  import GlobalTermFilter from "./GlobalTermFilter.svelte";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);
  let isDesktopPopoverOpen = $state(false);

  const isResidentView = $derived(page.url.pathname.startsWith("/resident"));

  const desktopMenuItems = $derived.by(() => {
    if (isResidentView) {
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
          icon: LayoutDashboard
        });
      }
      return items;
    }

    return [
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
        title: "Settings",
        url: "/admin/settings",
        icon: Settings
      }
    ].filter((i) => !i.hide);
  });
</script>

<header
  class="flex h-16 shrink-0 items-center justify-between gap-2 bg-background px-4 md:bg-sidebar md:px-2"
>
  <div class="flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon"
      class="hidden h-8 w-8 md:inline-flex"
      onclick={() => sidebar.toggle()}
      aria-label="Toggle sidebar"
    >
      {#if sidebar.open}
        <PanelLeftCloseIcon class="h-5 w-5 rotate-180" />
      {:else}
        <PanelLeftOpenIcon class="h-5 w-5" />
      {/if}
    </Button>
    <div class="flex items-center gap-2 px-1">
      <BrandingLogo class="h-10 w-auto object-contain" />
    </div>
    <GlobalTermFilter />
  </div>

  <div class="flex items-center gap-2">
    <!-- Mobile profile button -->
    <button
      onclick={() => sidebar.setOpenMobile(true)}
      class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-border transition-opacity hover:opacity-80 md:hidden"
      aria-label="Open menu"
    >
      {#if auth.avatarUrl && !imgError}
        <img
          src={auth.avatarUrl}
          alt={namecase(auth.displayName)}
          class="h-full w-full object-cover"
          onerror={() => (imgError = true)}
        />
      {:else}
        <CircleUser class="h-6 w-6 text-muted-foreground" />
      {/if}
    </button>

    <!-- Desktop profile popover -->
    <div class="hidden md:block">
      <Popover.Root bind:open={isDesktopPopoverOpen}>
        <Popover.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-border transition-opacity hover:opacity-80"
              aria-label="Open profile menu"
            >
              {#if auth.avatarUrl && !imgError}
                <img
                  src={auth.avatarUrl}
                  alt={namecase(auth.displayName)}
                  class="h-full w-full object-cover"
                  onerror={() => (imgError = true)}
                />
              {:else}
                <CircleUser class="h-6 w-6 text-muted-foreground" />
              {/if}
            </button>
          {/snippet}
        </Popover.Trigger>

        <Popover.Content
          align="end"
          sideOffset={8}
          class="w-72 gap-0 overflow-hidden rounded-lg p-0"
        >
          {#if auth.user}
            <div class="flex items-center gap-3 border-b border-border p-3">
              {#if !imgError}
                <img
                  src={auth.avatarUrl}
                  alt={namecase(auth.displayName)}
                  class="h-10 w-10 rounded-full border border-border object-cover"
                  onerror={() => (imgError = true)}
                />
              {:else}
                <CircleUser class="h-10 w-10 text-muted-foreground" />
              {/if}
              <div class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-medium text-foreground"
                  >{namecase(auth.displayName)}</span
                >
                <span class="truncate text-xs text-muted-foreground">{auth.user.email}</span>
              </div>
            </div>

            <Sidebar.Root collapsible="none" class="w-full bg-transparent">
              <Sidebar.Content>
                <Sidebar.Group class="p-1">
                  <Sidebar.GroupContent class="gap-0">
                    <Sidebar.Menu>
                      {#each desktopMenuItems as item}
                        <Sidebar.MenuItem>
                          <Sidebar.MenuButton
                            onclick={() => (isDesktopPopoverOpen = false)}
                            class="hover:bg-accent hover:text-accent-foreground"
                          >
                            {#snippet child({ props })}
                              <a
                                href={item.url}
                                {...props}
                                onclick={() => (isDesktopPopoverOpen = false)}
                              >
                                <item.icon />
                                <span>{item.title}</span>
                              </a>
                            {/snippet}
                          </Sidebar.MenuButton>
                        </Sidebar.MenuItem>
                      {/each}
                      <Sidebar.MenuItem>
                        <Sidebar.MenuButton
                          onclick={() => {
                            isDesktopPopoverOpen = false;
                            auth.signOut();
                          }}
                          class="hover:bg-accent hover:text-accent-foreground"
                        >
                          <LogOut />
                          <span>Sign out</span>
                        </Sidebar.MenuButton>
                      </Sidebar.MenuItem>
                    </Sidebar.Menu>
                  </Sidebar.GroupContent>
                </Sidebar.Group>
              </Sidebar.Content>
            </Sidebar.Root>
          {/if}
        </Popover.Content>
      </Popover.Root>
    </div>
  </div>
</header>
