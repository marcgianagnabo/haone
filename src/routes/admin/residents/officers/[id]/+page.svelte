<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "$ui/button";
  import { Save, Trash2 } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import {
    fetchOfficers,
    updateOfficer,
    deleteOfficer,
    transitionOfficerPosition
  } from "$api/controllers/officer-controller";
  import type { OfficerRecord } from "$lib/types";
  import { OfficerStatus } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { Label } from "$ui/label";
  import { Input } from "$ui/input";
  import * as Select from "$ui/select";
  import { goto } from "$app/navigation";
  import * as Card from "$ui/card";
  import * as AlertDialog from "$ui/alert-dialog";
  import { pageState } from "$state/page-info.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { translatePeriod } from "$utils/translators";
  import { globalDialog } from "$state/dialog.svelte";
  import ChangeOfficerPositionDialog from "$components/forms/ChangeOfficerPositionDialog.svelte";

  const { id } = page.params;
  let officer = $state<OfficerRecord | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let showChangePositionDialog = $state(false);
  let newPosition = $state("");

  let editData = $state({
    status: OfficerStatus.ACTIVE,
    position: "",
    nickname: "",
    committee: "",
    fbLink: "",
    birthday: "",
    photoUrl: ""
  });

  async function loadData() {
    isLoading = true;
    try {
      const officers = await fetchOfficers();
      const found = officers.find((o) => o.id === id);
      if (!found) {
        toast.error("Officer not found");
        goto("/admin/residents/officers");
        return;
      }
      officer = found;
      editData = {
        status: found.status as OfficerStatus,
        position: found.position,
        nickname: found.nickname,
        committee: found.committee,
        fbLink: found.fbLink,
        birthday: found.birthday,
        photoUrl: found.photoUrl || ""
      };
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Edit Officer";
    loadData();
  });

  const availablePositions = $derived(
    (brandingState.profile.officerPositions as { title: string; limit: number }[]) || []
  );

  async function handleUpdate() {
    if (!officer) return;

    if (editData.fbLink) {
      try {
        const url = new URL(editData.fbLink);
        if (
          !url.hostname.includes("facebook.com") &&
          !url.hostname.includes("fb.com") &&
          !url.hostname.includes("fb.me")
        ) {
          toast.error("Please provide a valid Facebook profile link");
          return;
        }
      } catch (e) {
        toast.error("Invalid Facebook link URL");
        return;
      }
    }

    isSaving = true;
    try {
      await updateOfficer(officer.id, {
        status: editData.status,
        nickname: editData.nickname,
        committee: editData.committee,
        fbLink: editData.fbLink,
        birthday: editData.birthday,
        photoUrl: editData.photoUrl.trim()
      });
      toast.success("Officer record updated");
      goto("/admin/residents/officers");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  async function handleChangePosition() {
    if (!officer || !newPosition) return;
    isSaving = true;
    try {
      await transitionOfficerPosition(officer.id, newPosition);
      toast.success("Position changed and new record created");
      goto("/admin/residents/officers");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
      showChangePositionDialog = false;
    }
  }

  async function handleDelete() {
    globalDialog.confirm(
      "Remove officer record?",
      "This officer record will be permanently deleted.",
      undefined,
      async () => {
        try {
          if (!officer) {
            return;
          }
          await deleteOfficer(officer.id);
          toast.success("Officer record removed.");
          goto("/admin/residents/officers");
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Remove",
        cancel: "Cancel"
      }
    );
  }

  const statusOptions = [
    { value: OfficerStatus.ACTIVE, label: "Active" },
    { value: OfficerStatus.RESIGNED, label: "Resigned" }
  ];

  const isImmutable = $derived(officer?.status === OfficerStatus.CHANGED_POSITION);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Edit Officer" />

  {#if isLoading}
    <LoadingView />
  {:else if officer}
    {#if isImmutable}
      <div
        class="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-600 dark:text-yellow-400"
      >
        This record is read-only because this officer has transitioned to a new position.
      </div>
    {/if}

    <Card.Root class="mx-auto max-w-2xl opacity-{isImmutable ? '70' : '100'}">
      <Card.Header>
        <Card.Title>{officer.name}</Card.Title>
        <Card.Description
          >Update officer details for {translatePeriod(officer.term)}.</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Status</Label>
            <Select.Root
              type="single"
              bind:value={editData.status}
              onValueChange={(v) => (editData.status = v as OfficerStatus)}
              disabled={isImmutable}
            >
              <Select.Trigger class="w-full">
                {statusOptions.find((s) => s.value === editData.status)?.label}
              </Select.Trigger>
              <Select.Content>
                {#each statusOptions as option}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="space-y-2">
            <Label>Position</Label>
            <div class="flex gap-2">
              <Input value={editData.position} readonly class="bg-muted" />
              <Button
                variant="outline"
                onclick={() => (showChangePositionDialog = true)}
                disabled={isImmutable}
              >
                Change
              </Button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Nickname (Optional)</Label>
            <Input bind:value={editData.nickname} placeholder="e.g., Joey" readonly={isImmutable} />
          </div>

          <div class="space-y-2">
            <Label>Committee (Optional)</Label>
            <Input
              bind:value={editData.committee}
              placeholder="e.g., Informaation"
              readonly={isImmutable}
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label>FB Link (Optional)</Label>
          <Input
            bind:value={editData.fbLink}
            placeholder="https://facebook.com/..."
            readonly={isImmutable}
          />
        </div>

        <div class="space-y-2">
          <Label>Birthday (Optional)</Label>
          <Input bind:value={editData.birthday} type="date" readonly={isImmutable} />
        </div>

        <div class="space-y-2">
          <Label>Photo URL (Optional)</Label>
          <div class="flex items-center gap-4">
            {#if editData.photoUrl.trim() || officer?.photoAutoUrl}
              <img
                src={editData.photoUrl.trim() || officer?.photoAutoUrl}
                alt={officer?.name}
                class="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            {/if}
            <Input
              bind:value={editData.photoUrl}
              placeholder="https://... (leave empty to use the Gmail photo)"
              readonly={isImmutable}
            />
          </div>
          {#if officer?.photoAutoUrl && !editData.photoUrl.trim()}
            <p class="text-xs text-muted-foreground">
              Showing the Gmail photo from sign-in. Enter a URL above to override it.
            </p>
          {/if}
        </div>

        <div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h4 class="text-sm font-bold text-destructive">Danger Zone</h4>
          <p class="mt-1 text-muted-foreground">
            Permanently removing an officer will delete their record from the directory.
          </p>
          <Button
            variant="destructive"
            size="sm"
            class="mt-4"
            onclick={() => handleDelete()}
            icon={Trash2}
            disabled={isImmutable}
          >
            Remove Permanently
          </Button>
        </div>
      </Card.Content>
      <Card.Footer class="justify-end gap-2 border-t pt-6">
        <Button onclick={handleUpdate} isLoading={isSaving} icon={Save} disabled={isImmutable}>
          Save
        </Button>
      </Card.Footer>
    </Card.Root>
  {/if}
</div>

<ChangeOfficerPositionDialog
  bind:open={showChangePositionDialog}
  bind:newPosition
  {availablePositions}
  {isSaving}
  onChangePosition={handleChangePosition}
  onCancel={() => (showChangePositionDialog = false)}
/>
