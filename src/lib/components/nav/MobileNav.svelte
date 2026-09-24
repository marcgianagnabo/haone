<script lang="ts">
  import {
    LayoutDashboard,
    History,
    Users,
    Wallet,
    WashingMachine,
    Megaphone,
    House,
    Banknote,
    Trophy,
    ListOrdered,
    Receipt,
    Bed,
    Contact,
    GraduationCap,
    Mail,
    Settings,
    BookUser,
    HandCoins,
    ChartPie,
    Refrigerator
  } from "@lucide/svelte";
  import { page } from "$app/state";
  import { settings } from "$state/settings.svelte";
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { isResidentRouteAllowed } from "$api/controllers/resident-controller";
  import { features } from "$state/features.svelte";

  const MAP_RESIDENT: Record<string, any> = {
    home: { label: "Home", href: "/resident", icon: LayoutDashboard },
    finance: { label: "Finance", href: "/resident/finance", icon: Wallet },
    occupancy: { label: "Occupancy", href: "/resident/occupancy", icon: House },
    laundry: { label: "Laundry", href: "/resident/laundry", icon: WashingMachine },
    fridge: { label: "Fridge", href: "/resident/fridge", icon: Refrigerator },
    payments: { label: "Payments", href: "/resident/payment-requests", icon: Banknote },
    news: { label: "News", href: "/resident/announcements", icon: Megaphone },
    achievements: { label: "Trophy", href: "/resident/achievements", icon: Trophy },
    leaderboards: {
      label: "Ranks",
      href: "/resident/leaderboards",
      icon: ListOrdered
    }
  };

  const MAP_ADMIN: Record<string, any> = {
    dashboard: { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    financial: { label: "Financial", href: "/admin/financial-report", icon: HandCoins },
    history: { label: "History", href: "/admin/transactions", icon: History },
    residents: { label: "Residents", href: "/admin/residents", icon: Users },
    users: { label: "Users", href: "/admin/users", icon: Contact },
    officers: { label: "Officers", href: "/admin/residents/officers", icon: BookUser },
    demographics: { label: "Demographics", href: "/admin/demographics", icon: ChartPie },
    terms: { label: "Terms", href: "/admin/academic-terms", icon: GraduationCap },
    dispatcher: { label: "Email", href: "/admin/email-dispatcher", icon: Mail },
    settings: { label: "Settings", href: "/admin/settings", icon: Settings },
    laundry: { label: "Laundry", href: "/admin/laundry", icon: WashingMachine },
    news: { label: "News", href: "/admin/announcements", icon: Megaphone },
    achievements: { label: "Trophy", href: "/admin/achievements", icon: Trophy },
    leaderboards: {
      label: "Ranks",
      href: "/admin/leaderboards",
      icon: ListOrdered
    }
  };

  const isAdmin = $derived(page.url.pathname.startsWith("/admin"));

  const navItems = $derived.by(() => {
    const ids = isAdmin ? settings.adminNavIds : settings.residentNavIds;
    const map = isAdmin ? MAP_ADMIN : MAP_RESIDENT;
    const items = ids.map((id) => map[id]).filter(Boolean);

    const filtered = features.achievementsEnabled
      ? items
      : items.filter((item) => {
          return !item.href.includes("/achievements") && !item.href.includes("/leaderboards");
        });

    if (isAdmin) {
      return filtered;
    }

    const type = residentState.status?.account?.type || "";
    const room = residentState.status?.account?.room || "";
    return filtered.filter((item) => {
      return isResidentRouteAllowed(item.href, type, room);
    });
  });

  const activeHref = $derived.by(() => {
    const pathname = page.url.pathname;
    const matches = navItems
      .map((i) => i.href)
      .filter((href) => {
        if (href === "/resident" || href === "/admin") {
          return pathname === href;
        }
        return pathname === href || pathname.startsWith(`${href}/`);
      });

    if (matches.length === 0) {
      return null;
    }
    return matches.reduce((longest, current) => {
      return current.length > longest.length ? current : longest;
    });
  });

  function isActive(href: string) {
    return activeHref === href;
  }
</script>

<div
  class="relative z-10 w-full shrink-0 bg-sidebar pb-[env(safe-area-inset-bottom,0px)] md:hidden"
>
  <nav class="flex h-16 items-center justify-around px-2">
    {#each navItems as item}
      {@const active = isActive(item.href)}
      {@const IconComponent = item.icon}
      <a
        href={item.href}
        class="group flex flex-1 flex-col items-center justify-center gap-1 outline-none"
      >
        <div
          class="flex h-8 w-16 items-center justify-center rounded-full transition-all duration-200 {active
            ? 'bg-brand/15 dark:bg-brand/30'
            : 'group-hover:bg-muted'}"
        >
          <IconComponent
            class="size-6 transition-colors duration-200 {active
              ? 'text-brand dark:brightness-140'
              : 'text-foreground group-hover:text-foreground'}"
          />
        </div>
        <span
          class="max-w-18 truncate text-xs font-medium transition-colors duration-200 {active
            ? 'text-brand dark:brightness-140'
            : 'text-foreground group-hover:text-foreground'}"
        >
          {item.label}
        </span>
      </a>
    {/each}
  </nav>
</div>
