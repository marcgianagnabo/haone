<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Pencil, Share2 } from "@lucide/svelte";
  import ContentHeader, { type HeaderAction } from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { toast } from "svelte-sonner";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs,
    updateAchievement
  } from "$api/controllers/achievement-controller";
  import { fetchUsers, fetchResidents } from "$api/controllers/resident-controller";
  import type { AchievementRecord } from "$lib/types";
  import AchievementDetailsView from "$components/residents/AchievementDetailsView.svelte";
  import { shareAchievementStory } from "$components/residents/story-share";
  import { settings } from "$state/settings.svelte";
  import AchievementFormDialog from "$components/forms/AchievementFormDialog.svelte";
  import { features } from "$state/features.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Trophy } from "@lucide/svelte";

  const id = page.params.id;

  let achievement = $state<AchievementRecord | null>(null);
  let earners = $state<{ residentId: string; name: string; date: string; isPublic: boolean }[]>([]);
  let isAdmin = $state(true);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let isSharingStory = $state(false);
  let error = $state<string | null>(null);
  let isEditorOpen = $state(false);

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

  interface EditState {
    id: string;
    name: string;
    description: string;
    icon: string;
    extraUrl: string;
    points: number;
    term: string;
    creatorId: string;
    isIndefinite: boolean;
  }

  let editData = $state<EditState>({
    id: "",
    name: "",
    description: "",
    icon: "🏆",
    extraUrl: "",
    points: 10,
    term: settings.currentTerm,
    creatorId: "",
    isIndefinite: false
  });

  function openEditor() {
    if (!achievement) {
      return;
    }
    editData = {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      extraUrl: achievement.extraUrl,
      points: achievement.points || 0,
      term: achievement.term || "",
      creatorId: achievement.creatorId,
      isIndefinite: !achievement.term
    };
    isEditorOpen = true;
  }

  async function handleUpdate() {
    isSaving = true;
    try {
      await updateAchievement(editData.id, {
        creatorId: editData.creatorId,
        name: editData.name,
        description: editData.description,
        icon: editData.icon,
        extraUrl: editData.extraUrl,
        points: Number(editData.points) || 0,
        term: editData.isIndefinite ? "" : editData.term
      });
      toast.success("Achievement updated");
      isEditorOpen = false;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      await features.load();
      if (!features.achievementsEnabled) {
        achievement = null;
        earners = [];
        return;
      }
      const [allA, allL, allU, allR] = await Promise.all([
        fetchAdminAchievements(bypassCache),
        fetchAchievementLogs(bypassCache),
        fetchUsers(bypassCache),
        fetchResidents(bypassCache)
      ]);

      const foundA =
        allA.find((a) => {
          return a.id === id;
        }) || null;
      if (!foundA) {
        throw new Error("Achievement not found");
      }

      const eligibleCount = foundA.term
        ? allR.filter((r) => {
            return r.period === foundA.term;
          }).length
        : allU.length;

      achievement = {
        ...foundA,
        totalEligibleCount: eligibleCount
      };

      const achievementLogs = allL.filter((l) => {
        return l.achievementId === id;
      });

      const userMap = new Map();
      allU.forEach((u) => {
        userMap.set(u.id, u.displayName || "Resident");
      });

      earners = achievementLogs.map((l) => {
        return {
          residentId: l.accountId,
          name: userMap.get(l.accountId) || "Resident",
          date: l.date,
          isPublic: true
        };
      });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Achievement Details"
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[
      ...(achievement
        ? [
            {
              label: "Share Story",
              icon: Share2,
              variant: "outline",
              isLoading: isSharingStory,
              onclick: handleShareStory
            },
            {
              label: "Edit",
              icon: Pencil,
              onclick: openEditor
            }
          ]
        : [])
    ] as HeaderAction[]}
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
  {:else if achievement}
    <AchievementDetailsView {achievement} {earners} {isAdmin} />
  {/if}
</div>

<AchievementFormDialog
  bind:open={isEditorOpen}
  title="Edit Achievement"
  bind:data={editData}
  isLoading={isSaving}
  submitLabel="Save Changes"
  onSubmit={handleUpdate}
  onCancel={() => (isEditorOpen = false)}
/>
