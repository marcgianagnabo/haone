<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Calculator, Save } from "@lucide/svelte";

  let {
    editingFeesFor = $bindable(null),
    feeData = $bindable(),
    errorMessage = "",
    isSaving = false,
    onSave,
    onCancel
  }: {
    editingFeesFor: { value: string; label: string } | null;
    feeData: {
      assoc: number;
      water: number;
      maintenance: number;
      total: number;
      assoc_cp: number;
      water_cp: number;
      maintenance_cp: number;
    };
    errorMessage?: string;
    isSaving?: boolean;
    onSave: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Dialog.Root
  open={!!editingFeesFor}
  onOpenChange={(o) => {
    if (!o) {
      onCancel();
    }
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Customize Fees</Dialog.Title>
      <Dialog.Description>
        Configure fees for <strong>{editingFeesFor?.label}</strong>.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-6 py-4">
      {#if errorMessage}
        <div class="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {errorMessage}
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>Association Fee</Label>
          <Input type="number" bind:value={feeData.assoc} step="0.01" />
        </div>
        <div class="space-y-2">
          <Label>Water Fee</Label>
          <Input type="number" bind:value={feeData.water} step="0.01" />
        </div>
        <div class="space-y-2">
          <Label>Maintenance & Gas Fee</Label>
          <Input type="number" bind:value={feeData.maintenance} step="0.01" />
        </div>
      </div>

      <div class="rounded-xl border bg-muted/30 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-muted-foreground">
            <Calculator class="h-4 w-4" />
            <span class="text-xs font-medium tracking-wider uppercase">Total Fee</span>
          </div>
          <span class="text-xl font-black text-foreground"
            >₱{feeData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span
          >
        </div>
      </div>

      <div class="h-px bg-border/50"></div>

      <div class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >Collection Periods (Times per Term)</Label
        >
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label class="text-xs">Association Fee</Label>
            <Input type="number" bind:value={feeData.assoc_cp} />
          </div>
          <div class="space-y-2">
            <Label class="text-xs">Water Fee</Label>
            <Input type="number" bind:value={feeData.water_cp} />
          </div>
          <div class="space-y-2">
            <Label class="text-xs">Maintenance & Gas Fee</Label>
            <Input type="number" bind:value={feeData.maintenance_cp} />
          </div>
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel} disabled={isSaving}>Cancel</Button>
      <Button onclick={onSave} isLoading={isSaving} icon={Save}>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
