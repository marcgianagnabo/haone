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
    ChevronDown,
    Award,
    Camera,
    ExternalLink,
    X
  } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import { brandingState } from "$state/branding.svelte";
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
  let isCaptionExpanded = $state(false);
  // Background mode (mobile sign-in): pick the backdrop photo here so the
  // bottom caption bar always describes the photo actually shown.
  const bgHeroItem = $derived.by((): FeaturedImageItem | null => {
    if (!mobilePhotoBackground) {
      return null;
    }
    const allHeroes: FeaturedImageItem[] = brandingState.profile?.hero || [];
    if (heroId) {
      const found = allHeroes.find((h) => h.id === heroId);
      if (found) {
        return found;
      }
    }
    const heroes = allHeroes.filter((h: FeaturedImageItem) => !h.hidden);
    if (heroes.length === 0) {
      return null;
    }
    return heroes[Math.floor(Math.random() * heroes.length)];
  });
  // Background mode (mobile sign-in): photo is always visible as a full-screen
  // backdrop, so the expand toggle and its open state don't apply.
  const heroPanelClass = $derived(
    mobilePhotoBackground
      ? "inset-0 z-0"
      : `right-0 left-0 top-0 z-50 ${isMobileHeroOpen ? "h-full" : "h-20"}`
  );
  function toggleMobileHero() {
    isMobileHeroOpen = !isMobileHeroOpen;
  }
</script>

<div
  class="relative flex min-h-screen flex-col bg-background md:h-screen md:flex-row md:overflow-hidden"
>
  {#snippet headerBar()}
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
  {/snippet}

  <!-- Panel: Hero -->
  <div
    class="fixed flex flex-col justify-between overflow-hidden bg-zinc-950 text-white transition-all duration-300 ease-in-out md:relative md:z-auto md:order-1 md:h-full lg:w-1/2 {heroPanelClass}"
  >
    <HeroVisual
      {heroId}
      heroItem={bgHeroItem}
      isMobileHidden={!isMobileHeroOpen && !mobilePhotoBackground}
      captionMobileHidden={mobilePhotoBackground}
    />
    {#if mobilePhotoBackground}
      <!-- Mobile-only readability scrim over the backdrop photo -->
      <div
        class="absolute inset-0 z-[6] bg-black/55 bg-gradient-to-b from-black/60 via-black/35 to-black/70 md:hidden"
        role="none"
      ></div>
    {:else}
      {@render headerBar()}
    {/if}
  </div>

  {#if mobilePhotoBackground}
    <!-- Own fixed layer above the content so the logo and menu stay tappable -->
    <div class="fixed inset-x-0 top-0 z-20 md:hidden">
      {@render headerBar()}
    </div>
  {/if}

  {#if mobilePhotoBackground && bgHeroItem}
    <!-- Mobile-only photo info bar over the bottom of the backdrop -->
    <div class="fixed inset-x-0 bottom-0 z-20 md:hidden">
      <div
        class="space-y-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 pt-10 text-white"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-0.5">
            <h2 class="truncate text-sm font-bold drop-shadow-sm">{bgHeroItem.title}</h2>
            <p class="truncate text-[11px] font-medium tracking-wide text-white/80 uppercase">
              {bgHeroItem.author}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            {#if bgHeroItem.voteLink}
              <Button
                href={bgHeroItem.voteLink}
                target="_blank"
                rel="noreferrer noopener"
                variant="secondary"
                size="sm"
                class="h-8 rounded-lg bg-white/15 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/25 hover:text-white"
                icon={ExternalLink}
                iconPosition="right"
              >
                Vote
              </Button>
            {/if}
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() => (isCaptionExpanded = !isCaptionExpanded)}
              class="h-8 w-8 rounded-lg bg-white/15 text-white backdrop-blur-md hover:bg-white/25 hover:text-white"
              aria-expanded={isCaptionExpanded}
              aria-label={isCaptionExpanded ? "Collapse description" : "Expand description"}
            >
              <ChevronDown
                class="h-4 w-4 transition-transform duration-300 {isCaptionExpanded
                  ? 'rotate-180'
                  : 'rotate-0'}"
              />
            </Button>
          </div>
        </div>
        {#if isCaptionExpanded}
          <div transition:slide={{ duration: 250 }} class="space-y-2 overflow-hidden">
            {#if bgHeroItem.award}
              <div>
                <div
                  class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md"
                >
                  <Award class="h-3.5 w-3.5" />
                  <span>{bgHeroItem.award}</span>
                </div>
              </div>
            {/if}
            <p
              class="max-h-40 overflow-y-auto pr-1 text-xs leading-relaxed whitespace-pre-line text-white/90"
            >
              {bgHeroItem.description}
            </p>
            {#if bgHeroItem.camera}
              <div class="flex items-center gap-1.5 pt-1 font-mono text-xs text-white/70">
                <Camera class="h-3.5 w-3.5 shrink-0" />
                <span>
                  {bgHeroItem.camera}{#if bgHeroItem.cameraDetails}
                    {" ∙ "}{bgHeroItem.cameraDetails}
                  {/if}
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Panel: Main Content -->
  <div
    class="relative order-1 flex flex-1 flex-col items-center overflow-y-auto p-6 md:h-full md:p-8 {mobilePhotoBackground
      ? 'z-10 pb-24 md:pb-8'
      : ''} pt-20 md:pt-8"
  >
    <div class="my-auto flex w-full {contentClass} flex-col justify-center space-y-8 py-8">
      {@render children()}
    </div>
  </div>
</div>
