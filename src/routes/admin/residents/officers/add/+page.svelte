<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { Save } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import { addOfficer, fetchOfficers } from "$api/controllers/officer-controller";
  import { fetchResidents } from "$api/controllers/resident-controller";
  import { brandingState } from "$state/branding.svelte";
  import type { OfficerRecord, ResidentRecord } from "$lib/types";
  import { OfficerStatus } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { Label } from "$ui/label";
  import { Input } from "$ui/input";
  import { Combobox } from "$ui/combobox";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { pageState } from "$state/page-info.svelte";
  import * as Card from "$ui/card";

  import { translatePeriod } from "$utils/translators";
  import { settings } from "$state/settings.svelte";

  let residents = $state<ResidentRecord[]>([]);
  let officers = $state<OfficerRecord[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);

  let newOfficerData = $state({
    residentId: page.url.searchParams.get("residentId") || "",
    position: page.url.searchParams.get("position") || "",
    nickname: "",
    committee: "",
    fbLink: "",
    birthday: "",
    photoUrl: ""
  });

  async function loadData() {
    isLoading = true;
    try {
      [residents, officers] = await Promise.all([fetchResidents(), fetchOfficers()]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Add Officer";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  const positions = $derived(
    (brandingState.profile.officerPositions as { title: string; limit: number }[]) || []
  );

  const availablePositions = $derived.by(() => {
    return positions.map((p) => {
      const currentCount = officers.filter(
        (o) => o.position === p.title && o.term === settings.currentTerm
      ).length;
      const isFull = p.limit > 0 && currentCount >= p.limit;
      return {
        label: p.title + (p.limit > 0 ? ` (${currentCount}/${p.limit})` : ""),
        value: p.title,
        disabled: isFull
      };
    });
  });

  const residentOptions = $derived(
    residents
      .filter((r) => r.period === settings.currentTerm)
      .map((r) => ({
        label: `${r.name} (${r.room}${r.bed})`,
        value: r.residentId
      }))
  );

  async function handleAddOfficer() {
    if (!newOfficerData.residentId || !newOfficerData.position) {
      toast.error("Please select a resident and a position");
      return;
    }

    const resident = residents.find((r) => r.residentId === newOfficerData.residentId);
    if (!resident) return;

    if (newOfficerData.fbLink) {
      try {
        const url = new URL(newOfficerData.fbLink);
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
      await addOfficer({
        position: newOfficerData.position,
        name: resident.name,
        nickname: newOfficerData.nickname,
        email: resident.email,
        fbLink: newOfficerData.fbLink,
        term: settings.currentTerm,
        committee: newOfficerData.committee,
        birthday: newOfficerData.birthday,
        photoUrl: newOfficerData.photoUrl.trim(),
        photoAutoUrl: "",
        id: "",
        status: OfficerStatus.ACTIVE
      });
      toast.success("Officer added successfully");
      goto("/admin/residents/officers");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Add Officer" />

  {#if isLoading}
    <LoadingView />
  {:else}
    <Card.Root class="mx-auto max-w-2xl">
      <Card.Header>
        <Card.Title>Officer Details</Card.Title>
        <Card.Description
          >Assign a resident to an officer position for {translatePeriod(
            settings.currentTerm
          )}.</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="space-y-2">
          <Label>Resident</Label>
          <Combobox
            options={residentOptions}
            bind:value={newOfficerData.residentId}
            placeholder="Select resident…"
          />
        </div>

        <div class="space-y-2">
          <Label>Position</Label>
          <Combobox
            options={availablePositions}
            bind:value={newOfficerData.position}
            placeholder="Select position…"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Nickname (Optional)</Label>
            <Input bind:value={newOfficerData.nickname} placeholder="e.g., Joey" />
          </div>

          <div class="space-y-2">
            <Label>Committee (Optional)</Label>
            <Input bind:value={newOfficerData.committee} placeholder="e.g., Informataion" />
          </div>
        </div>

        <div class="space-y-2">
          <Label>FB Link (Optional)</Label>
          <Input bind:value={newOfficerData.fbLink} placeholder="https://facebook.com/..." />
        </div>

        <div class="space-y-2">
          <Label>Birthday (Optional)</Label>
          <Input bind:value={newOfficerData.birthday} type="date" />
        </div>

        <div class="space-y-2">
          <Label>Photo URL (Optional)</Label>
          <Input
            bind:value={newOfficerData.photoUrl}
            placeholder="https://... (leave empty to use the Gmail photo)"
          />
        </div>
      </Card.Content>
      <Card.Footer class="justify-end gap-2 border-t pt-6">
        <Button onclick={handleAddOfficer} isLoading={isSaving} icon={Save}>Assign</Button>
      </Card.Footer>
    </Card.Root>
  {/if}
</div>
