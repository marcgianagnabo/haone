<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$state/branding.svelte";
  import type { FeaturedImageItem } from "$lib/types";
  import { Camera, ExternalLink, Award, ChevronDown } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import { slide, fade, fly } from "svelte/transition";

  let {
    isMobileHidden = false,
    captionMobileHidden = false,
    heroItem: externalHero = undefined,
    heroId = undefined
  }: {
    isMobileHidden?: boolean;
    captionMobileHidden?: boolean;
    heroItem?: FeaturedImageItem | null;
    heroId?: string;
  } = $props();
  let internalHero = $state<FeaturedImageItem | null>(null);
  // A provided hero always wins so callers can keep a separate caption in sync
  // with the photo actually shown.
  const heroItem = $derived(externalHero ?? internalHero);
  let isExpanded = $state(false);
  let isImageLoaded = $state(false);

  onMount(() => {
    if (externalHero) {
      return;
    }
    const allHeroes: FeaturedImageItem[] = brandingState.profile?.hero || [];
    if (heroId) {
      const found = allHeroes.find((h) => h.id === heroId);
      if (found) {
        internalHero = found;
        return;
      }
    }
    const heroes = allHeroes.filter((h: FeaturedImageItem) => !h.hidden);
    if (heroes.length > 0) {
      const randomIndex = Math.floor(Math.random() * heroes.length);
      internalHero = heroes[randomIndex];
    }
  });

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  function handleImageLoad(node: HTMLImageElement) {
    if (node.complete) {
      isImageLoaded = true;
    }
  }
</script>

<div class="absolute inset-0 flex h-full w-full flex-col justify-end overflow-hidden bg-zinc-950">
  <!-- Original animated mesh gradient default background -->
  <div class="mesh-gradient"></div>
  <div class="vignette"></div>

  {#if heroItem}
    <img
      src={heroItem.image}
      alt={heroItem.title || "Hero Image"}
      draggable="false"
      onload={() => {
        isImageLoaded = true;
      }}
      use:handleImageLoad
      oncontextmenu={(e) => {
        e.preventDefault();
      }}
      class="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 select-none {isMobileHidden
        ? 'hidden md:block'
        : 'block'} {isImageLoaded ? 'opacity-100' : 'opacity-0'}"
    />
    <!-- Transparent overlay shield against context menu / drag save -->
    <div
      class="absolute inset-0 z-5 {isMobileHidden ? 'hidden md:block' : 'block'}"
      role="none"
      oncontextmenu={(e) => {
        e.preventDefault();
      }}
    ></div>

    {#if isImageLoaded}
      <!-- Gradient tied tightly to the bottom card with gentle fade -->
      <div
        in:fly={{ y: 20, duration: 600, delay: 150 }}
        class="relative z-10 space-y-3 bg-linear-to-t from-black/85 via-black/50 to-transparent p-6 pt-12 text-white md:p-8 md:pt-16 {isMobileHidden ||
        captionMobileHidden
          ? 'hidden md:block'
          : 'block'}"
      >
        <!-- Title, Author, and Action Controls (Vote & Accordion Toggle) -->
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">
              {heroItem.title}
            </h2>
            <p class="text-xs font-medium tracking-wide text-white/80 uppercase">
              {heroItem.author}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            {#if heroItem.voteLink}
              <Button
                href={heroItem.voteLink}
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
              onclick={toggleExpand}
              class="h-8 w-8 rounded-lg bg-white/15 text-white backdrop-blur-md hover:bg-white/25 hover:text-white"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse description" : "Expand description"}
            >
              <ChevronDown
                class="h-4 w-4 transition-transform duration-300 {isExpanded
                  ? 'rotate-180'
                  : 'rotate-0'}"
              />
            </Button>
          </div>
        </div>

        {#if isExpanded}
          <div transition:slide={{ duration: 250 }} class="space-y-3 overflow-hidden pt-1">
            {#if heroItem.award}
              <div>
                <div
                  class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md"
                >
                  <Award class="h-3.5 w-3.5" />
                  <span>{heroItem.award}</span>
                </div>
              </div>
            {/if}

            <p
              class="max-h-60 overflow-y-auto pr-1 text-xs leading-relaxed whitespace-pre-line text-white/90 drop-shadow-xs"
            >
              {heroItem.description}
            </p>

            {#if heroItem.camera}
              <div class="flex items-center gap-1.5 pt-1 font-mono text-xs text-white/70">
                <Camera class="h-3.5 w-3.5 shrink-0" />
                <span>
                  {heroItem.camera}{#if heroItem.cameraDetails}
                    {" ∙ "}{heroItem.cameraDetails}
                  {/if}
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .mesh-gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 30%, #7b1113 0%, transparent 40%),
      radial-gradient(circle at 80% 20%, #4a0a0b 0%, transparent 40%),
      radial-gradient(circle at 50% 80%, #2d5a27 0%, transparent 50%),
      radial-gradient(circle at 10% 90%, #7b1113 0%, transparent 40%),
      radial-gradient(circle at 90% 90%, #4a0a0b 0%, transparent 40%);
    filter: blur(80px);
    opacity: 0.6;
    animation: aurora 30s ease-in-out infinite alternate;
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%);
    pointer-events: none;
  }

  @keyframes aurora {
    0% {
      transform: scale(1) rotate(0deg);
    }
    33% {
      transform: scale(1.2) rotate(2deg);
    }
    66% {
      transform: scale(1.1) rotate(-2deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }
</style>
