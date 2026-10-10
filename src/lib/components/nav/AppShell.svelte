<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Sidebar from "$ui/sidebar";
  import AppSidebar from "$components/nav/AppSidebar.svelte";
  import AppHeader from "$components/nav/AppHeader.svelte";
  import MobileNav from "$components/nav/MobileNav.svelte";
  import { LoaderCircleIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { fly, fade } from "svelte/transition";
  import { createHeaderScrollState } from "$utils/scroll.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { IsMobile } from "$lib/hooks/is-mobile.svelte.js";

  let {
    isLoading = false,
    children
  }: {
    isLoading?: boolean;
    children: Snippet;
  } = $props();

  const scrollState = createHeaderScrollState();
  const isMobile = new IsMobile();

  // The shell (and its scroll state) persists across client-side navigations
  // while the scroll container is recreated per page at scrollTop 0. Reset
  // on navigation so a header hidden on the previous page never carries over.
  $effect(() => {
    page.url.pathname;
    scrollState.reset();
  });

  // Mobile: header stays pinned (no auto-hide, always visible even on
  // subpages). Desktop keeps hide-on-scroll-down / show-on-scroll-up.
  const headerHidden = $derived(isMobile.current ? false : scrollState.headerHidden);
</script>

{#if isLoading}
  <div
    out:fade={{ duration: 250 }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-background"
  >
    <LoaderCircleIcon class="h-5 w-5 animate-spin text-foreground" />
  </div>
{/if}

{#if !isLoading}
  <Sidebar.Provider class="h-svh w-full overflow-hidden bg-sidebar">
    <div
      class="fixed inset-x-0 top-0 z-20 h-16 transition-transform duration-300 ease-in-out {headerHidden
        ? '-translate-y-full'
        : 'translate-y-0'}"
    >
      <AppHeader />
    </div>
    <div
      class="absolute inset-x-0 bottom-0 flex overflow-hidden transition-[top] duration-300 ease-in-out {headerHidden
        ? 'top-0'
        : 'top-16'}"
    >
      <AppSidebar />
      <Sidebar.Inset class="relative flex flex-col overflow-hidden md:rounded-tl-4xl">
        {#key page.url.pathname}
          <div
            in:fly={{ duration: 200, delay: 80, y: 6, opacity: 0 }}
            out:fly={{ duration: 120, y: -6, opacity: 0 }}
            class="absolute inset-0 {pageState.isTopLevel
              ? 'bottom-16'
              : 'bottom-0'} overflow-y-auto md:bottom-0"
            onscroll={scrollState.handleScroll}
          >
            <main class="p-4 md:p-8">
              {@render children()}
            </main>
          </div>
        {/key}
        <!-- Flex spacer pushes nav to bottom of screen flow -->
        <div class="flex-1"></div>
        {#if pageState.isTopLevel}
          <MobileNav />
        {/if}
      </Sidebar.Inset>
    </div>
  </Sidebar.Provider>
{/if}
