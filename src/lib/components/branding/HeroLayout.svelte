<script lang="ts">
  import type { Snippet } from "svelte";
  import HeroVisual from "$components/branding/HeroVisual.svelte";
  import { Button } from "$ui/button";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import {
    FileText,
    ShieldCheck,
    EllipsisVerticalIcon,
    Image as ImageIcon,
    X
  } from "@lucide/svelte";
  import { brandingState } from "$state/branding.svelte";
  import { pwaInstall } from "$state/pwa-install.svelte";
  import type { FeaturedImageItem } from "$lib/types";

  let {
    children,
    heroId = undefined,
    contentClass = "max-w-100",
    mobilePhotoBackground = false
  }: {
    children: Snippet;
    heroId?: string;
    contentClass?: string;
    mobilePhotoBackground?: boolean;
  } = $props();

  const LEGAL_LINKS = [
    { label: "Terms of Service", shortLabel: "Terms", href: "/terms", icon: FileText },
    { label: "Privacy Policy", shortLabel: "Privacy", href: "/privacy", icon: ShieldCheck }
  ];

  const hasHeroImage = $derived(
    Boolean(
      brandingState.profile.hero &&
      (heroId
        ? brandingState.profile.hero.some((h: FeaturedImageItem) => h.id === heroId)
        : brandingState.profile.hero.some((h: FeaturedImageItem) => !h.hidden))
    )
  );

  let isMobileHeroOpen = $state(false);
  const bannerVisible = $derived(pwaInstall.shouldShowBanner);
  // Background mode (mobile sign-in): photo is always visible as a full-screen
  // backdrop, so the expand toggle and its open state don't apply.
  const heroPanelClass = $derived(
    mobilePhotoBackground
      ? "inset-0 z-0"
      : `right-0 left-0 z-50 ${bannerVisible ? "top-10" : "top-0"} ${isMobileHeroOpen ? "h-full" : "h-20"}`
  );
  function toggleMobileHero() {
    isMobileHeroOpen = !isMobileHeroOpen;
  }
</script>

<div
  class="relative flex min-h-screen flex-col bg-background md:h-screen md:flex-row md:overflow-hidden"
>
  <!-- Panel: Hero -->
  <div
    class="fixed flex flex-col justify-between overflow-hidden bg-zinc-950 text-white transition-all duration-300 ease-in-out md:relative md:z-auto md:order-1 md:h-full lg:w-1/2 {heroPanelClass}"
  >
    <HeroVisual
      {heroId}
      isMobileHidden={!isMobileHeroOpen && !mobilePhotoBackground}
      captionMobileHidden={mobilePhotoBackground}
    />
    {#if mobilePhotoBackground}
      <!-- Mobile-only readability scrim over the backdrop photo -->
      <div
        class="absolute inset-0 z-[6] bg-black/55 bg-gradient-to-b from-black/60 via-black/35 to-black/70 md:hidden"
        role="none"
      ></div>
    {/if}

    <!-- Top header overlay -->
    <div
      class="relative z-20 flex items-center justify-between bg-linear-to-b from-black/85 via-black/50 to-transparent p-6 md:p-8"
    >
      <div
        class="flex items-center text-xl font-bold tracking-tight text-white {isMobileHeroOpen
          ? 'hidden md:flex'
          : 'flex'}"
      >
        <img src="/ha1_bw.svg" alt="HAOne" class="mr-3 h-8 w-8 drop-shadow-md" />
        <span class="drop-shadow-md">HAOne</span>
        {#if __APP_SUFFIX__ !== ""}
          <div
            class="ml-2 inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold tracking-wider text-white uppercase backdrop-blur-md"
          >
            {__APP_SUFFIX__}
          </div>
        {/if}
      </div>

      <!-- Header Action Buttons -->
      <div class="flex items-center gap-1 {isMobileHeroOpen ? 'ml-auto' : ''}">
        {#if hasHeroImage && !mobilePhotoBackground}
          <!-- Mobile Hero Image Toggle (Image / X) -->
          <div class="md:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={toggleMobileHero}
              class="h-8 w-8 rounded-lg bg-white/15 text-white backdrop-blur-md hover:bg-white/25 hover:text-white"
              aria-label={isMobileHeroOpen ? "Close featured image" : "View featured image"}
            >
              {#if isMobileHeroOpen}
                <X class="h-4 w-4" />
              {:else}
                <ImageIcon class="h-4 w-4" />
              {/if}
            </Button>
          </div>
        {/if}

        <!-- 3-Dot Dropdown Menu -->
        <div class={isMobileHeroOpen ? "hidden md:block" : "block"}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="h-8 w-8 rounded-lg bg-white/15 text-white backdrop-blur-md hover:bg-white/25 hover:text-white"
                  {...props}
                >
                  <EllipsisVerticalIcon class="h-4 w-4" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-44">
              {#each LEGAL_LINKS as link}
                <DropdownMenu.Item>
                  {#snippet child({ props })}
                    {@const Icon = link.icon}
                    <a href={link.href} class="flex w-full items-center gap-2" {...props}>
                      <Icon class="h-4 w-4" />
                      <span>{link.label}</span>
                    </a>
                  {/snippet}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  </div>

  <!-- Panel: Main Content -->
  <div
    class="relative order-1 flex flex-1 flex-col items-center overflow-y-auto p-6 md:h-full md:p-8 {mobilePhotoBackground
      ? 'z-10'
      : ''} {bannerVisible ? 'pt-[7.5rem] md:pt-8' : 'pt-20 md:pt-8'}"
  >
    <div class="my-auto flex w-full {contentClass} flex-col justify-center space-y-8 py-8">
      {@render children()}
    </div>
  </div>
</div>
