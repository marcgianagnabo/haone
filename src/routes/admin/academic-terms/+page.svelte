<script lang="ts">
  import { onMount } from "svelte";
  import { settings } from "$state/settings.svelte";
  import {
    fetchConstants,
    addConstant,
    updateConstant,
    fetchTerms
  } from "$api/controllers/constants-controller";
  import { translatePeriod } from "$utils/translators";
  import { sortPeriods } from "$utils/sort";
  import { Button } from "$ui/button";
  import { Plus, GraduationCap, Coins, CircleCheck } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import { Badge } from "$ui/badge";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { toast } from "svelte-sonner";
  import AddAcademicTermDialog from "$components/forms/AddAcademicTermDialog.svelte";
  import EditTermFeesDialog from "$components/forms/EditTermFeesDialog.svelte";

  let terms = $state<{ value: string; description: string }[]>([]);
  let allConstants = $state<{ key: string; value: string; rowIndex: number }[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let showAddDialog = $state(false);
  let errorMessage = $state("");
  let activeTermCode = $state("");

  let newStartYear = $state(new Date().getFullYear());
  let newTerm = $state("1S");

  // Fee Editing State
  let editingFeesFor = $state<{ value: string; label: string } | null>(null);
  let feeData = $state({
    assoc: 0,
    water: 0,
    maintenance: 0,
    total: 0,
    assoc_cp: 0,
    water_cp: 0,
    maintenance_cp: 0
  });

  const termOptions = [
    { value: "1S", label: "1st Semester" },
    { value: "2S", label: "2nd Semester" },
    { value: "MY", label: "Midyear Term" }
  ];

  async function loadTerms(bypassCache = false) {
    isLoading = true;
    errorMessage = "";
    try {
      const records = await fetchConstants(bypassCache);
      allConstants = records.map((r, idx) => ({
        key: r.key,
        value: r.value,
        rowIndex: idx
      }));

      const filtered = await fetchTerms(bypassCache);

      const sortedValues = sortPeriods(filtered.map((t) => t.value));

      terms = sortedValues.map((val) => {
        const found = filtered.find((f) => f.value === val);
        return {
          value: val,
          description: found?.description || ""
        };
      });

      activeTermCode = allConstants.find((c) => c.key === "TERM_CURR")?.value || "";
    } catch (e) {
      console.error("Load failed", e);
      errorMessage = "Failed to load academic terms.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => loadTerms());

  async function handleAdd() {
    errorMessage = "";
    const yy = String(newStartYear).slice(-2);
    const zz = String(newStartYear + 1).slice(-2);
    const value = `${yy}${zz}_${newTerm}`;
    const key = `TERM_${value}`;
    const description = `AY 20${yy}-20${zz} ${termOptions.find((t) => t.value === newTerm)?.label}`;

    // Check if exists
    if (terms.some((s) => s.value === value) || allConstants.some((c) => c.key === key)) {
      errorMessage = "This academic term already exists.";
      return;
    }

    isSaving = true;
    try {
      await addConstant(key, value, description);
      showAddDialog = false;
      await loadTerms();
    } catch (e) {
      errorMessage = "Failed to append to constants. Please try again.";
      console.error(e);
    } finally {
      isSaving = false;
    }
  }

  function openFees(term: { value: string; label: string }) {
    editingFeesFor = term;
    const p = term.value;

    const getVal = (suffix: string) => {
      const key = `FEES_${p}_${suffix}`;
      const found = allConstants.find((c) => c.key === key);
      return found ? parseFloat(found.value) || 0 : 0;
    };

    feeData = {
      assoc: getVal("ASSOC"),
      water: getVal("WATER"),
      maintenance: getVal("MAINTENANCE"),
      total: getVal("TOTAL"),
      assoc_cp: getVal("ASSOC_CP"),
      water_cp: getVal("WATER_CP"),
      maintenance_cp: getVal("MAINTENANCE_CP")
    };
  }

  // Reactive total calculation
  $effect(() => {
    feeData.total =
      (feeData.assoc || 0) + (feeData.water || 0) + (feeData.maintenance || 0);
  });

  async function saveFees() {
    if (!editingFeesFor) {
      return;
    }
    isSaving = true;
    errorMessage = "";

    const p = editingFeesFor.value;
    const updates = [
      { suffix: "ASSOC", val: feeData.assoc },
      { suffix: "WATER", val: feeData.water },
      { suffix: "MAINTENANCE", val: feeData.maintenance },
      { suffix: "TOTAL", val: feeData.total },
      { suffix: "ASSOC_CP", val: feeData.assoc_cp },
      { suffix: "WATER_CP", val: feeData.water_cp },
      { suffix: "MAINTENANCE_CP", val: feeData.maintenance_cp }
    ];

    try {
      for (const u of updates) {
        const key = `FEES_${p}_${u.suffix}`;
        const existing = allConstants.find((c) => c.key === key);
        if (existing) {
          await updateConstant(key, String(u.val));
        } else {
          await addConstant(key, String(u.val), `Fee for ${p} (${u.suffix})`);
        }
      }

      editingFeesFor = null;
      await loadTerms();
    } catch (e) {
      console.error(e);
      errorMessage = "Failed to save fees.";
    } finally {
      isSaving = false;
    }
  }

  async function setActive(value: string) {
    const activeTermConstant = allConstants.find((c) => c.key === "TERM_CURR");
    if (activeTermConstant) {
      await updateConstant("TERM_CURR", value);
    } else {
      await addConstant("TERM_CURR", value, "Active Term");
    }
    settings.currentTerm = value;
    settings.activeTerm = value;
    await loadTerms();
  }

  function handleSetActive(id: string): any {
    globalDialog.confirm(
      "Change active term?",
      `This sets ${translatePeriod(id)} as the primary academic term, updating balance calculations and default filters.`,
      undefined,
      async () => {
        if (!id) {
          return;
        }
        try {
          await setActive(id);
          toast.success("Active term updated.");
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Change term",
        cancel: "Cancel"
      }
    );
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Academic Terms"
    isTopLevel={true}
    onRefresh={() => loadTerms(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Add", onclick: () => (showAddDialog = true), icon: Plus }]}
  />

  <div class="space-y-4">
    {#if isLoading}
      <LoadingView />
    {:else if errorMessage && terms.length === 0}
      <ErrorView error={errorMessage} />
    {:else if terms.length === 0}
      <EmptyView title="No terms defined." description="Add an academic term to get started.">
        {#snippet icon()}
          <GraduationCap class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {:else}
      <div class="space-y-3">
        {#each terms as term}
          <div
            class="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:bg-muted/50"
          >
            <div class="rounded-lg bg-brand/10 p-2 text-brand">
              <GraduationCap class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <p class="text-base font-bold text-foreground">
                  {translatePeriod(term.value)}
                </p>
                {#if activeTermCode === term.value}
                  <Badge
                    variant="outline"
                    class="gap-1 border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-600 uppercase"
                  >
                    <CircleCheck class="h-3 w-3" />
                    Active
                  </Badge>
                {/if}
              </div>
            </div>

            <div class="flex items-center gap-1">
              {#if activeTermCode !== term.value}
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 gap-2 text-xs font-bold tracking-wider uppercase"
                  onclick={() => handleSetActive(term.value)}
                  disabled={isSaving}
                >
                  Set Active
                </Button>
              {/if}
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 rounded-lg"
                onclick={() => openFees({ value: term.value, label: translatePeriod(term.value) })}
                title="Edit Fees"
                icon={Coins}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<AddAcademicTermDialog
  bind:open={showAddDialog}
  bind:newStartYear
  bind:newTerm
  {termOptions}
  {errorMessage}
  {isSaving}
  onAdd={handleAdd}
  onCancel={() => (showAddDialog = false)}
/>

<EditTermFeesDialog
  bind:editingFeesFor
  bind:feeData
  {errorMessage}
  {isSaving}
  onSave={saveFees}
  onCancel={() => (editingFeesFor = null)}
/>
