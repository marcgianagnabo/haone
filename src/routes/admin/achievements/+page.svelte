<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Trophy } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs,
    addAchievement
  } from "$api/controllers/achievement-controller";
  import { fetchResidents, fetchUsers } from "$api/controllers/resident-controller";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { Checkbox } from "$ui/checkbox";
  import { Label } from "$ui/label";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import AchievementTabs from "$components/tabs/AchievementTabs.svelte";
  import { settings } from "$state/settings.svelte";
  import { calculateAchievementPercentage } from "$api/controllers/achievement-controller";
  import AchievementCard from "$components/residents/AchievementCard.svelte";
  import AchievementFormDialog from "$components/forms/AchievementFormDialog.svelte";
  import { features } from "$state/features.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentUserId = $state("");
  let totalUsersCount = $state(0);
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  let isCreatorOpen = $state(false);

  let newAchievement = $state({
    name: "",
    description: "",
    icon: "🏆",
    extraUrl: "",
    points: 10,
    term: settings.currentTerm,
    isIndefinite: false
  });

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

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      await features.load();
      if (!features.achievementsEnabled) {
        achievements = [];
        logs = [];
        totalUsersCount = 0;
        return;
      }
      const [a, l, r, allU] = await Promise.all([
        fetchAdminAchievements(bypassCache),
        fetchAchievementLogs(bypassCache),
        fetchResidents(bypassCache),
        fetchUsers(bypassCache)
      ]);
      const accountsCountMap = new Map<string, number>();
      r.forEach((res) => {
        const term = (res.period || "").trim();
        if (term) {
          accountsCountMap.set(term, (accountsCountMap.get(term) || 0) + 1);
        }
      });

      achievements = a.map((ach) => {
        const eligible = ach.term ? accountsCountMap.get(ach.term) || 0 : allU.length;
        return {
          ...ach,
          totalEligibleCount: eligible
        };
      });
      logs = l;
      totalUsersCount = allU.length;
      currentUserId = auth.userId;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleCreate() {
    try {
      await addAchievement({
        id: crypto.randomUUID(),
        creatorId: currentUserId,
        name: newAchievement.name,
        description: newAchievement.description,
        icon: newAchievement.icon,
        extraUrl: newAchievement.extraUrl,
        points: Number(newAchievement.points) || 0,
        term: newAchievement.isIndefinite ? "" : newAchievement.term
      });
      toast.success("Achievement created");
      isCreatorOpen = false;
      newAchievement = {
        name: "",
        description: "",
        icon: "🏆",
        extraUrl: "",
        points: 10,
        term: settings.currentTerm,
        isIndefinite: false
      };
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  $effect(() => {
    settings.currentTerm;
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Achievements"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    hasFilter={!isGlobal}
    actions={[
      {
        label: "New",
        icon: Plus,
        onclick: () => {
          isCreatorOpen = true;
        }
      }
    ]}
  >
    {#snippet tabs()}
      <AchievementTabs bind:value={scope} />
    {/snippet}
  </ContentHeader>

  {#if !features.achievementsEnabled}
    <EmptyView
      title="Achievements are disabled"
      description="The achievements feature is currently turned off by the administrator."
      class="col-span-full py-8"
    >
      {#snippet icon()}
        <Trophy class="h-8 w-8 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    {#if !isGlobal}
      <FilterDrawer>
        <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div class="flex items-center space-x-2 pb-1.5">
            <Checkbox id="admin-show-all-time" bind:checked={settings.showAllTimeAchievements} />
            <Label for="admin-show-all-time" class="cursor-pointer text-xs font-medium">
              Show all-time achievements
            </Label>
          </div>
        </div>
      </FilterDrawer>
    {/if}

    <div class="flex flex-col gap-2.5">
      {#each filteredAchievements as a}
        {@const uniqueEarnersCount = new Set(
          logs.filter((l) => l.achievementId === a.id).map((l) => l.accountId)
        ).size}
        <div>
          <AchievementCard
            achievement={a}
            alwaysShowPercentage={true}
            percentage={calculateAchievementPercentage(
              uniqueEarnersCount,
              a.totalEligibleCount || 0
            )}
            href="/admin/achievements/{a.id}"
          />
        </div>
      {:else}
        <EmptyView
          title="No achievements defined."
          description="Achievements created by admins will appear here."
          class="col-span-full py-8"
        >
          {#snippet icon()}
            <Trophy class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/each}
    </div>
  {/if}
</div>

<AchievementFormDialog
  bind:open={isCreatorOpen}
  title="New Achievement"
  bind:data={newAchievement}
  submitLabel="Create"
  onSubmit={handleCreate}
  onCancel={() => (isCreatorOpen = false)}
/>
