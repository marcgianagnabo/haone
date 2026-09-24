<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import AchievementTabs from "$components/tabs/AchievementTabs.svelte";
  import AchievementLeaderboard from "$components/residents/AchievementLeaderboard.svelte";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs
  } from "$api/controllers/achievement-controller";
  import { fetchUserSettings } from "$api/controllers/settings-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { settings } from "$state/settings.svelte";
  import { pageState } from "$state/page-info.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import { features } from "$state/features.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Trophy } from "@lucide/svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
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
        return;
      }
      const [achievementRows, logRows, users, settings] = await Promise.all([
        fetchAdminAchievements(bypassCache),
        fetchAchievementLogs(bypassCache),
        fetchUsers(bypassCache),
        fetchUserSettings(bypassCache)
      ]);

      const userMap = new Map(
        users.map((user) => {
          return [user.id, user.displayName || "Resident"];
        })
      );
      const publicMap = new Map(
        settings.map((setting) => {
          return [setting.residentId, setting.isPublicAchievementList];
        })
      );

      achievements = achievementRows;
      logs = logRows.map((log) => {
        const isPublic = publicMap.get(log.accountId) !== false;
        return {
          ...log,
          displayName: isPublic ? userMap.get(log.accountId) || "Resident" : "Private Player",
          isPublic
        };
      });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Leaderboards";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Leaderboards"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  >
    {#snippet tabs()}
      <AchievementTabs bind:value={scope} />
    {/snippet}
  </ContentHeader>

  {#if !features.achievementsEnabled}
    <EmptyView
      title="Leaderboards are disabled"
      description="The leaderboards feature is currently turned off by the administrator."
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
          loadData();
        }}
        class="mt-4"
        {isLoading}
        icon={RefreshCcw}>Retry</Button
      >
    </ErrorView>
  {:else}
    <AchievementLeaderboard {achievements} {logs} term={settings.currentTerm} {isGlobal} />
  {/if}
</div>
