<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { Button } from "$ui/button";
  import { Trophy } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { Checkbox } from "$ui/checkbox";
  import { Label } from "$ui/label";
  import AchievementTabs from "$components/tabs/AchievementTabs.svelte";
  import { settings } from "$state/settings.svelte";
  import {
    fetchAchievements,
    calculateAchievementPercentage
  } from "$api/controllers/achievement-controller";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/types";
  import { pageState } from "$state/page-info.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import AchievementCard from "$components/residents/AchievementCard.svelte";
  import { features } from "$state/features.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentResidentId = $state("");
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      await features.load();
      if (!features.achievementsEnabled) {
        achievements = [];
        logs = [];
        currentResidentId = "";
        return;
      }
      const [achResult] = await Promise.all([fetchAchievements(bypassCache)]);
      achievements = achResult.achievements || [];
      logs = achResult.logs || [];
      currentResidentId = achResult.currentResidentId || "";
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Achievements";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  let earnedIds = $derived(
    new Set(
      logs
        .filter((l) => {
          if (!currentResidentId && !auth.userId) {
            return false;
          }
          return currentResidentId && l.accountId === currentResidentId;
        })
        .map((l) => l.achievementId)
    )
  );

  let filteredAchievements = $derived(
    achievements.filter((a) => {
      if (isGlobal) {
        return true;
      }
      const isIndefinite = !a.term;
      if (isIndefinite) {
        return settings.showAllTimeAchievements;
      }
      return a.term === settings.currentTerm;
    })
  );

  let earnedAchievements = $derived(
    filteredAchievements.filter((a) => {
      return earnedIds.has(a.id);
    })
  );

  let lockedAchievements = $derived(
    filteredAchievements.filter((a) => {
      return !earnedIds.has(a.id);
    })
  );
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Achievements"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    hasFilter={scope !== "global"}
  >
    {#snippet tabs()}
      <AchievementTabs bind:value={scope} />
    {/snippet}
  </ContentHeader>

  {#if !features.achievementsEnabled}
    <EmptyView
      title="Achievements are disabled"
      description="The achievements feature is currently turned off by the administrator."
    >
      {#snippet icon()}
        <Trophy class="h-12 w-12 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        onclick={() => {
          loadData(true);
        }}
        class="mt-4">Retry</Button
      >
    </ErrorView>
  {:else}
    <!-- Filter Bar (shown in Term mode) -->
    {#if !isGlobal}
      <FilterDrawer>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex items-center space-x-2 pb-1.5">
            <Checkbox id="show-all-time" bind:checked={settings.showAllTimeAchievements} />
            <Label for="show-all-time" class="cursor-pointer text-xs font-medium">
              Show all-time achievements
            </Label>
          </div>
        </div>
      </FilterDrawer>
    {/if}

    <!-- Achievements List Container -->
    <div class="mx-auto max-w-5xl">
      <div class="flex flex-col gap-2.5">
        {#each earnedAchievements as a}
          {@const userLog = logs.find(
            (l) =>
              l.achievementId === a.id && currentResidentId && l.accountId === currentResidentId
          )}
          {@const uniqueEarnersCount = new Set(
            logs.filter((l) => l.achievementId === a.id).map((l) => l.accountId)
          ).size}
          <div>
            <AchievementCard
              achievement={a}
              isEarned={true}
              unlockedAt={userLog?.date || ""}
              percentage={calculateAchievementPercentage(
                uniqueEarnersCount,
                a.totalEligibleCount || 0
              )}
              href="/resident/achievements/{a.id}"
              showStatusBadge={true}
            />
          </div>
        {/each}

        {#each lockedAchievements as a}
          <div>
            <AchievementCard
              achievement={a}
              isEarned={false}
              percentage={0}
              href=""
              showStatusBadge={true}
              lockedCount={1}
            />
          </div>
        {/each}

        {#if filteredAchievements.length === 0}
          <div class="col-span-full py-8">
            <EmptyView
              title="No Achievements Available"
              description="Keep participating in dormitory activities to unlock rewards."
            >
              {#snippet icon()}
                <Trophy class="h-12 w-12 text-muted-foreground" />
              {/snippet}
            </EmptyView>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
