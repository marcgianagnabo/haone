<script lang="ts">
  import { Button } from "$ui/button";
  import { ExternalLink, Lock as LockIcon, Sparkles } from "@lucide/svelte";
  import * as Card from "$ui/card";
  import type { AchievementRecord } from "$lib/types";
  import {
    formatAwardDate,
    calculateAchievementPercentage
  } from "$api/controllers/achievement-controller";

  interface Earner {
    residentId: string;
    name: string;
    date: string;
    isPublic: boolean;
  }

  let {
    achievement,
    earners,
    isAdmin = false,
    currentResidentId = ""
  } = $props<{
    achievement: AchievementRecord;
    earners: Earner[];
    isAdmin?: boolean;
    currentResidentId?: string;
  }>();

  let uniqueEarnersCount = $derived(new Set(earners.map((e: Earner) => e.residentId)).size);

  let percentage = $derived(
    calculateAchievementPercentage(uniqueEarnersCount, achievement.totalEligibleCount || 0)
  );

  // Privacy toggle removed: all earners are shown.
  let publicEarners = $derived(earners);

  let hasCurrentResidentEarned = $derived(
    earners.some((e: Earner) => {
      return e.residentId === currentResidentId;
    })
  );
</script>

<div class="space-y-8">
  <div>
    <Card.Root class="group relative overflow-hidden border-0 bg-brand/5 p-0 text-center">
      <div class="absolute inset-x-8 top-5 flex justify-between text-2xl opacity-30">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
        <span>✧</span>
      </div>
      <div
        class="absolute top-12 -left-8 h-24 w-24 rotate-12 rounded-md border-2 border-brand/30 bg-background/60 shadow-lg"
      ></div>
      <div
        class="absolute top-20 -right-8 h-20 w-20 -rotate-12 rounded-md border-2 border-brand/30 bg-background/60 shadow-lg"
      ></div>
      <div class="absolute bottom-8 left-8 h-10 w-10 rotate-45 rounded-sm bg-brand/20"></div>
      <div
        class="absolute right-12 bottom-12 h-14 w-14 -rotate-12 rounded-sm border border-brand/30"
      ></div>

      <div class="relative px-5 pt-10 pb-8 sm:px-8 sm:pb-10">
        <div
          class="mx-auto mb-5 flex w-fit items-center gap-2 rounded-md border-2 border-brand/40 bg-background px-4 py-1.5 text-xs font-black text-brand uppercase shadow-lg shadow-brand/10"
        >
          <Sparkles class="h-3.5 w-3.5 animate-pulse" />
          Achievement Unlocked
          <Sparkles class="h-3.5 w-3.5 animate-pulse" />
        </div>

        <div class="relative mx-auto mb-6 grid h-44 w-44 place-items-center">
          <div
            class="absolute inset-0 rotate-6 rounded-3xl border-4 border-brand/30 bg-background shadow-2xl shadow-brand/20 transition-transform duration-300 group-hover:rotate-12"
          ></div>
          <div
            class="absolute inset-3 -rotate-6 rounded-3xl border-2 border-dashed border-brand/50 transition-transform duration-300 group-hover:-rotate-12"
          ></div>
          <div
            class="absolute -top-2 -right-2 rounded-md border-2 border-brand/40 bg-background px-2 py-1 text-xs font-black text-brand shadow-md"
          >
            +{achievement.points || 0} XP
          </div>
          <div
            class="absolute -bottom-2 -left-2 rounded-md border-2 border-brand/40 bg-background px-2 py-1 text-xs font-black text-brand shadow-md"
          >
            GG
          </div>
          <div
            class="relative text-8xl drop-shadow-sm transition-transform duration-300 group-hover:scale-125"
          >
            {achievement.icon || "🏆"}
          </div>
        </div>

        <div class="relative space-y-4">
          <h2 class="text-3xl font-black tracking-tight sm:text-5xl">{achievement.name}</h2>
          <p class="mx-auto max-w-2xl text-base leading-relaxed font-medium text-muted-foreground">
            {achievement.description}
          </p>

          <div class="mx-auto grid max-w-xs gap-2 pt-2">
            <div class="rounded-md border-2 border-brand/30 bg-background p-3 shadow-sm">
              {#if achievement.totalEligibleCount && achievement.totalEligibleCount > 0}
                <div class="text-sm font-bold">{percentage}% of residents</div>
                <div class="text-xs font-semibold text-muted-foreground">have this achievement</div>
              {/if}
            </div>
          </div>
        </div>

        {#if achievement.extraUrl}
          <Button
            href={achievement.extraUrl}
            target="_blank"
            class="relative mt-6 gap-2 shadow-lg shadow-brand/20"
          >
            Learn More
            <ExternalLink class="h-4 w-4" />
          </Button>
        {/if}
      </div>
    </Card.Root>
  </div>

  <div class="space-y-6">
    {#if isAdmin || hasCurrentResidentEarned}
      <div class="grid gap-3 sm:grid-cols-3">
        {#each publicEarners as earner}
          <Card.Root class="border-brand/20">
            <Card.Content>
              <div class="text-sm font-bold">
                {earner.name}
              </div>
              <div class="text-sm">
                {formatAwardDate(earner.date)}
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {:else}
      <div
        class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-muted/5 p-12"
      >
        <LockIcon class="mb-4 h-8 w-8 text-muted-foreground" />
        <p class="text-sm font-medium text-muted-foreground">
          Earn this achievement to see who else has it!
        </p>
      </div>
    {/if}
  </div>
</div>
