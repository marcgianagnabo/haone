<script lang="ts">
  import * as Card from "$ui/card";
  import EmptyView from "$components/content/EmptyView.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import { Crown, Medal, Trophy, Zap } from "@lucide/svelte";

  let {
    achievements,
    logs,
    term,
    isGlobal = false
  }: {
    achievements: AchievementRecord[];
    logs: AchievementLogRecord[];
    term: string;
    isGlobal?: boolean;
  } = $props();

  interface LeaderboardRow {
    residentId: string;
    displayName: string;
    isPublic: boolean;
    points: number;
    achievements: number;
    icons: string[];
    rank: number;
  }

  const eligibleAchievementIds = $derived(
    new Set(
      achievements
        .filter((achievement) => {
          if (isGlobal) {
            return true;
          }

          return Boolean(achievement.term) && achievement.term === term;
        })
        .map((achievement) => {
          return achievement.id;
        })
    )
  );

  const achievementMap = $derived(
    new Map(
      achievements.map((achievement) => {
        return [achievement.id, achievement];
      })
    )
  );

  let rows = $derived.by(() => {
    const rowMap = new Map<string, LeaderboardRow>();

    logs.forEach((log) => {
      if (!eligibleAchievementIds.has(log.achievementId)) {
        return;
      }

      const achievement = achievementMap.get(log.achievementId);
      if (!achievement) {
        return;
      }

      const existing = rowMap.get(log.accountId);
      // Privacy toggle removed: names are always shown.
      const isPublic = true;
      const displayName = log.displayName || "RESIDENT";

      if (!existing) {
        rowMap.set(log.accountId, {
          residentId: log.accountId,
          displayName,
          isPublic,
          points: achievement.points || 0,
          achievements: 1,
          icons: [achievement.icon || "🏆"],
          rank: 0
        });
        return;
      }

      existing.points += achievement.points || 0;
      existing.achievements += 1;
      existing.icons = [...existing.icons, achievement.icon || "🏆"].slice(0, 5);
      if (isPublic) {
        existing.displayName = displayName;
        existing.isPublic = true;
      }
    });

    return Array.from(rowMap.values())
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        if (b.achievements !== a.achievements) {
          return b.achievements - a.achievements;
        }

        return a.displayName.localeCompare(b.displayName);
      })
      .map((row, index) => {
        return {
          ...row,
          rank: index + 1
        };
      });
  });

  const podium = $derived(rows.slice(0, 3));
  const rest = $derived(
    rows.slice(3).filter((row) => {
      return row.isPublic;
    })
  );

  function podiumHeight(index: number) {
    if (index === 0) {
      return "h-48";
    }

    if (index === 1) {
      return "h-36";
    }

    return "h-28";
  }

  function podiumOrder(index: number) {
    if (index === 0) {
      return "md:order-2";
    }

    if (index === 1) {
      return "md:order-1";
    }

    return "md:order-3";
  }
</script>

<div class="space-y-6">
  {#if podium.length > 0}
    <Card.Root class="relative overflow-hidden border-0 bg-brand/5">
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
        class="absolute -right-8 bottom-12 h-24 w-24 -rotate-12 rounded-md border-2 border-brand/30 bg-background/60 shadow-lg"
      ></div>

      <Card.Content class="relative p-6 sm:p-8">
        <div class="grid gap-3 md:grid-cols-3 md:items-end">
          {#each podium as row, index}
            <div class={`flex flex-col ${podiumOrder(index)}`}>
              <div
                class="relative rounded-t-md border-2 border-b-0 border-brand/30 bg-background p-4 text-center shadow-lg shadow-brand/10"
              >
                <div
                  class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-md"
                >
                  {#if index === 0}
                    <Crown class="h-6 w-6" />
                  {:else}
                    <Medal class="h-6 w-6" />
                  {/if}
                </div>
                <div class="truncate text-lg font-bold">
                  {row.displayName}
                </div>
                <div class="flex items-center justify-center gap-2 text-3xl font-bold text-brand">
                  {row.points}
                  <span class="text-sm font-bold text-muted-foreground">XP</span>
                </div>
                <div
                  class="mt-2 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground"
                >
                  <span>{row.achievements} badge{row.achievements === 1 ? "" : "s"}</span>
                </div>
                <div class="flex justify-center gap-1 pt-3">
                  {#each row.icons as icon}
                    <span class="grid h-7 w-7 place-items-center rounded-md bg-brand/10 text-sm">
                      {icon}
                    </span>
                  {/each}
                </div>
              </div>
              <div
                class={`${podiumHeight(index)} grid place-items-center rounded-b-md border-2 border-brand/30 bg-brand text-brand-foreground shadow-lg shadow-brand/20`}
              >
                <div class="text-6xl leading-none font-bold">{row.rank}</div>
              </div>
            </div>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <div class="space-y-2">
    {#each rest as row, index}
      <Card.Root class="border-brand/20">
        <Card.Content class="flex items-center gap-3 px-3">
          <div
            class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand/10 text-xs font-bold text-brand"
          >
            #{row.rank}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-semibold">{row.displayName}</div>
            <div class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              {row.achievements} badge{row.achievements === 1 ? "" : "s"}
            </div>
          </div>
          <div class="flex items-center gap-1 text-lg font-bold text-brand">
            <Zap class="h-4 w-4" />
            {row.points}
            <span class="text-xs font-bold text-muted-foreground">XP</span>
          </div>
        </Card.Content>
      </Card.Root>
    {:else}
      {#if podium.length === 0}
        <EmptyView
          title="No scores yet."
          description="Award achievements to start the leaderboards."
        >
          {#snippet icon()}
            <Trophy class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/if}
    {/each}
  </div>
</div>
