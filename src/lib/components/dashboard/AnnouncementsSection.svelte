<script lang="ts">
  import { onMount } from "svelte";
  import { fetchAnnouncements } from "$api/controllers/announcement-controller";
  import type { AnnouncementRecord } from "$lib/types";
  import * as Card from "$ui/card";
  import { ChevronRight, ChevronLeft } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import RichTextRenderer from "$components/editor/RichTextRenderer.svelte";
  import { Badge } from "$ui/badge";
  import { ANNOUNCEMENT_TAG_COLORS } from "$lib/types";
  import { goto } from "$app/navigation";
  import { Skeleton } from "$components/ui/skeleton";
  import { computeDaysAgo } from "$utils/calendar";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let activeIndex = $state(0);

  async function loadData() {
    try {
      announcements = await fetchAnnouncements();
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  function nextSlide() {
    activeIndex = (activeIndex + 1) % announcements.length;
  }

  function prevSlide() {
    activeIndex = (activeIndex - 1 + announcements.length) % announcements.length;
  }

  onMount(loadData);
</script>

{#if isLoading}
  <Skeleton class="h-175 w-full" />
{:else if announcements.length > 0}
  <div class="flex flex-row items-center justify-between">
    <h2 class="h2-base">Announcements</h2>
    {#if announcements.length > 1}
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          onclick={prevSlide}
          title="Previous"
          aria-label="Previous announcement"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          onclick={nextSlide}
          title="Next"
          aria-label="Next announcement"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    {/if}
  </div>
  <div
    onclick={() => goto(`/resident/announcements/${announcements[activeIndex].slug}`)}
    onkeydown={(e) => {
      if (e.key === "Enter") {
        goto(`/resident/announcements/${announcements[activeIndex].slug}`);
      }
    }}
    role="button"
    tabindex="0"
  >
    <Card.Root
      class="relative mx-auto mt-6 flex h-175 w-full max-w-full cursor-pointer flex-col overflow-hidden transition-colors hover:bg-muted/60"
    >
      <div
        class="flex min-h-0 flex-1 transition-transform duration-300 ease-out"
        style="transform: translateX(-{activeIndex * 100}%);"
      >
        {#each announcements as a}
          {@const startDate = new Date(
            announcements[activeIndex].startDate || announcements[activeIndex].dateCreated
          )}
          {@const daysAgo = computeDaysAgo(startDate, new Date())}
          <div class="relative flex h-full w-full shrink-0 flex-col overflow-hidden">
            <Card.Title class="px-6 pb-4">
              <div>{a.title}</div>
              <span class="text-xs text-muted-foreground">
                {startDate.toLocaleString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}, {daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`}
              </span>
            </Card.Title>
            <Card.Content class="overflow-hidden">
              <RichTextRenderer
                bind:content={a.content}
                class="prose prose-sm prose-slate dark:prose-invert max-w-none"
              />
            </Card.Content>

            <!-- Gradient Fade Overlay -->
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-card to-transparent"
            ></div>
          </div>
        {/each}
      </div>

      <!-- Fixed Footer Block -->
      {#if announcements[activeIndex].tags}
        <div class="flex flex-wrap gap-1 px-6">
          {#each announcements[activeIndex].tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean) as tag}
            <Badge
              variant="secondary"
              class="px-2 py-0.5 text-xs {ANNOUNCEMENT_TAG_COLORS[tag.toUpperCase()] ||
                ANNOUNCEMENT_TAG_COLORS.DEFAULT}"
            >
              {tag}
            </Badge>
          {/each}
        </div>
      {/if}
    </Card.Root>
  </div>
{/if}
