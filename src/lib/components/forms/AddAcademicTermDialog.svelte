<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Plus, Calculator } from "@lucide/svelte";

  let {
    open = $bindable(false),
    newStartYear = $bindable(new Date().getFullYear()),
    newTerm = $bindable("1S"),
    newAssoc = $bindable(0),
    newWater = $bindable(0),
    newMaintenance = $bindable(0),
    termOptions,
    errorMessage = "",
    isSaving = false,
    onAdd,
    onCancel
  }: {
    open: boolean;
    newStartYear: number;
    newTerm: string;
    newAssoc: number;
    newWater: number;
    newMaintenance: number;
    termOptions: { value: string; label: string }[];
    errorMessage?: string;
    isSaving?: boolean;
    onAdd: () => void;
    onCancel: () => void;
  } = $props();

  const newTotal = $derived((newAssoc || 0) + (newWater || 0) + (newMaintenance || 0));
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add New Academic Term</Dialog.Title>
      <Dialog.Description>
        This will create a new semester code and append it to the constants sheet.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 pb-4">
      {#if errorMessage}
        <div class="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {errorMessage}
        </div>
      {/if}

      <div class="space-y-2">
        <Label for="startYear">Academic Year Start</Label>
        <div class="flex items-center gap-3">
          <Input
            id="startYear"
            type="number"
            bind:value={newStartYear}
            min="2020"
            max="2100"
            class="flex-1"
          />
          <span class="text-sm text-muted-foreground">to {newStartYear + 1}</span>
        </div>
      </div>

      <div class="space-y-2">
        <Label>Term Type</Label>
        <Combobox bind:value={newTerm} options={termOptions} class="w-full" />
      </div>

      <div class="h-px bg-border/50"></div>

      <div class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >Customize Fees</Label
        >
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Association Fee</Label>
            <Input type="number" bind:value={newAssoc} step="0.01" min="0" />
          </div>
          <div class="space-y-2">
            <Label>Water Fee</Label>
            <Input type="number" bind:value={newWater} step="0.01" min="0" />
          </div>
          <div class="space-y-2">
            <Label>Maintenance & Gas Fee</Label>
            <Input type="number" bind:value={newMaintenance} step="0.01" min="0" />
          </div>
        </div>

        <div class="rounded-xl border bg-muted/30 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-muted-foreground">
              <Calculator class="h-4 w-4" />
              <span class="text-xs font-medium tracking-wider uppercase">Total Fee</span>
            </div>
            <span class="text-xl font-black text-foreground"
              >₱{newTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span
            >
          </div>
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel} disabled={isSaving}>Cancel</Button>
      <Button onclick={onAdd} isLoading={isSaving} icon={Plus}>Create</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
