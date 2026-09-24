<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Share2 } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { fetchAchievements } from "$api/controllers/achievement-controller";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/types";
  import { toast } from "svelte-sonner";

  import AchievementDetailsView from "$components/residents/AchievementDetailsView.svelte";
  import { shareAchievementStory } from "$components/residents/story-share";
  import { features } from "$state/features.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Trophy } from "@lucide/svelte";

  const id = page.params.id;

  let achievement = $state<AchievementRecord | null>(null);
  let allLogs = $state<AchievementLogRecord[]>([]);
  let earners = $state<{ residentId: string; name: string; date: string; isPublic: boolean }[]>([]);
  let currentResidentId = $state("");
  let isLoading = $state(true);
  let isSharingStory = $state(false);
  let error = $state<string | null>(null);

  let isEarned = $derived(
    allLogs.some((l) => {
      return l.achievementId === id && l.accountId === currentResidentId;
    })
  );

  async function handleShareStory() {
    if (!achievement) {
      return;
    }
    isSharingStory = true;
    try {
      await shareAchievementStory(achievement);
    } catch (e) {
      console.error(e);
      toast.error("Could not prepare the story image");
    } finally {
      isSharingStory = false;
    }
  }

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      await features.load();
      if (!features.achievementsEnabled) {
        achievement = null;
        allLogs = [];
        earners = [];
        currentResidentId = "";
        return;
      }
      const achResult = await fetchAchievements(bypassCache);
      const allA = achResult.achievements;
      currentResidentId = achResult.currentResidentId;
      allLogs = achResult.logs;

      achievement =
        allA.find((a) => {
          return a.id === id;
        }) || null;

      if (!achievement) {
        throw new Error("Achievement not found.");
      }

      const logsForThis = allLogs.filter((l) => {
        return l.achievementId === id;
      });
      earners = logsForThis.map((l) => {
        return {
          residentId: l.accountId,
          name: l.displayName || "Resident",
          date: l.date,
          isPublic: l.isPublic ?? false
        };
      });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => loadData());
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Achievement Details"
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[
      ...(achievement && isEarned
        ? [
            {
              label: "Share Story",
              icon: Share2,
              isLoading: isSharingStory,
              onclick: handleShareStory
            }
          ]
        : [])
    ]}
  />

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
          loadData();
        }}
        class="mt-4"
        {isLoading}
        icon={RefreshCcw}>Retry</Button
      >
    </ErrorView>
  {:else if achievement && isEarned}
    <AchievementDetailsView {achievement} {earners} isAdmin={false} {currentResidentId} />
  {:else if achievement}
    <div class="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div class="animate-pulse text-9xl">🔒</div>
      <h2 class="text-3xl font-bold tracking-tight">Locked Achievement</h2>
      <p class="max-w-sm text-muted-foreground">
        This achievement is still waiting for you… keep going and you might just unlock it.
      </p>
    </div>
  {/if}
</div>
