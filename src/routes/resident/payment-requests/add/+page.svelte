<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { addPaymentRequest } from "$api/controllers/payment-request-controller";
  import { fetchServer } from "$utils/api-client";
  import { formatCurrency, formatAccounting } from "$utils/formatters";
  import { TransactionType, type ResidentRecord } from "$lib/types";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import * as Card from "$ui/card";
  import { Combobox } from "$ui/combobox";
  import {
    Calendar,
    Wallet,
    Link,
    ArrowLeftToLine,
    TriangleAlert,
    HandCoins
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import * as Tooltip from "$ui/tooltip";
  import { Badge } from "$ui/badge";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { ImageUpload } from "$components/ui/haone";

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let resident = $state<ResidentRecord | null>(null);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let pendingFile = $state<File | Blob | null>(null);
  let previewUrl = $state<string | null>(null);

  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    waterFee: "0",
    assocFee: "0",
    maintenanceFee: "0",
    miscFee: "0",
    mop: "GCASH",
    proofLink: "",
    notes: ""
  });

  const waterLimit = $derived(resident?.waterBal || 0);
  const assocLimit = $derived(resident?.assocBal || 0);
  const maintenanceLimit = $derived(resident?.maintenanceBal || 0);

  const currentWaterBal = $derived.by(() => {
    if (!resident) return 0;
    return waterLimit - (Number(formData.waterFee) || 0);
  });

  const currentAssocBal = $derived.by(() => {
    if (!resident) return 0;
    return assocLimit - (Number(formData.assocFee) || 0);
  });

  const currentMaintenanceBal = $derived.by(() => {
    if (!resident) return 0;
    return maintenanceLimit - (Number(formData.maintenanceFee) || 0);
  });

  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const statusData = await fetchResidentStatus();
      resident = statusData.account;
      mopTypes = statusData.mopTypes;
      if (!resident) {
        return;
      }
    } catch (e: any) {
      error = e.message || "Failed to load account data";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Add Payment Request";
    loadData();
  });

  async function handleSubmit() {
    if (!resident) return;

    const water = parseFloat(formData.waterFee) || 0;
    const assoc = parseFloat(formData.assocFee) || 0;
    const maintenance = parseFloat(formData.maintenanceFee) || 0;
    const misc = parseFloat(formData.miscFee) || 0;

    if (water === 0 && assoc === 0 && maintenance === 0 && misc === 0) {
      toast.error("Please enter at least one fee amount");
      return;
    }

    if (!formData.proofLink.trim()) {
      toast.error("Proof of payment is required");
      return;
    }

    try {
      if (formData.proofLink !== "PENDING_UPLOAD") {
        new URL(formData.proofLink);
      }
    } catch (e) {
      toast.error("Invalid proof of payment. Please provide a valid URL.");
      return;
    }

    isSubmitting = true;
    try {
      let finalProofLink = formData.proofLink;

      if (pendingFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", pendingFile, "payment_proof.jpg");
        const data = await fetchServer("/api/upload?type=payments", {
          method: "POST",
          body: formDataUpload
        });
        finalProofLink = data.url;
      }

      await addPaymentRequest({
        id: crypto.randomUUID(),
        residentId: resident!.residentId,
        date: formData.date,
        waterFee: water,
        assocFee: assoc,
        maintenanceFee: maintenance,
        misc: misc,
        mop: formData.mop,
        type:
          misc > 0 || maintenance > 0
            ? TransactionType.COLLECTION_OTHERS
            : TransactionType.COLLECTION,
        proofLink: finalProofLink,
        status: "PENDING",
        notes: formData.notes
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      toast.success("Payment submitted successfully");
      goto("/resident/payment-requests");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Add Payment Request" />
  <div class="mx-auto max-w-3xl space-y-6">
    {#if isLoading}
      <LoadingView />
    {:else if error}
      <ErrorView error={error || "Account record not found."} />
    {:else}
      <Card.Root>
        <Card.Content class="space-y-8">
          <!-- General Info Section -->
          <div class="space-y-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Calendar class="h-3.5 w-3.5" /> General Information
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Transaction Date</Label>
                <Input type="date" bind:value={formData.date} disabled={isSubmitting} />
              </div>
              <div class="space-y-2">
                <Label>Payment Method</Label>
                <Combobox
                  bind:value={formData.mop}
                  options={mopTypes}
                  disabled={isSubmitting}
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- Payment Details Section -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Wallet class="h-3.5 w-3.5" /> Payment Details
            </Label>

            <div class="space-y-6">
              <!-- Water Fee Row -->
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label>Water Fee</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.waterFee}
                      disabled={isSubmitting}
                      class="text-right font-mono"
                    />
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button
                            variant="outline"
                            size="icon"
                            class="h-9 w-9 shrink-0"
                            {...props}
                            onclick={() => (formData.waterFee = waterLimit.toString())}
                            disabled={waterLimit <= 0 || isSubmitting}
                            icon={ArrowLeftToLine}
                          />
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p class="text-xs font-bold">Pay remaining water balance</p>
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label>New Water Balance</Label>
                  <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                    {#if currentWaterBal < 0}
                      <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                    {:else}
                      <span></span>
                    {/if}
                    <div
                      class="font-mono text-sm font-bold {currentWaterBal > 0
                        ? 'text-destructive'
                        : 'text-primary'}"
                    >
                      {formatAccounting(currentWaterBal)}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Association Fee Row -->
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label>Association Fee</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.assocFee}
                      disabled={isSubmitting}
                      class="text-right font-mono"
                    />
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button
                            variant="outline"
                            size="icon"
                            class="h-9 w-9 shrink-0"
                            {...props}
                            onclick={() => (formData.assocFee = assocLimit.toString())}
                            disabled={assocLimit <= 0 || isSubmitting}
                            icon={ArrowLeftToLine}
                          />
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p class="text-xs font-bold">Pay remaining assoc balance</p>
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label>New Association Balance</Label>
                  <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                    {#if currentAssocBal < 0}
                      <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                    {:else}
                      <span></span>
                    {/if}
                    <div
                      class="font-mono text-sm font-bold {currentAssocBal > 0
                        ? 'text-destructive'
                        : 'text-primary'}"
                    >
                      {formatAccounting(currentAssocBal)}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Maintenance Fee Row -->
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label>Maintenance & Gas Fee</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.maintenanceFee}
                      disabled={isSubmitting}
                      class="text-right font-mono"
                    />
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button
                            variant="outline"
                            size="icon"
                            class="h-9 w-9 shrink-0"
                            {...props}
                            onclick={() => (formData.maintenanceFee = maintenanceLimit.toString())}
                            disabled={maintenanceLimit <= 0 || isSubmitting}
                            icon={ArrowLeftToLine}
                          />
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p class="text-xs font-bold">Pay remaining maintenance & gas balance</p>
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label>New Maintenance & Gas Balance</Label>
                  <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                    {#if currentMaintenanceBal < 0}
                      <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                    {:else}
                      <span></span>
                    {/if}
                    <div
                      class="font-mono text-sm font-bold {currentMaintenanceBal > 0
                        ? 'text-destructive'
                        : 'text-primary'}"
                    >
                      {formatAccounting(currentMaintenanceBal)}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Misc Fee Row -->
              <div class="space-y-1.5">
                <Label>Misc / Other Payments</Label>
                <Input
                  type="number"
                  step="0.01"
                  bind:value={formData.miscFee}
                  disabled={isSubmitting}
                  class="text-right font-mono"
                />
              </div>
            </div>
          </div>

          <!-- Proof & Notes Section -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Link class="h-3.5 w-3.5" /> Verification
            </Label>
            <div class="space-y-4">
              <ImageUpload
                label="Proof of Payment"
                bind:value={formData.proofLink}
                bind:file={pendingFile}
                bind:previewUrl
                allowUrl={true}
                disabled={isSubmitting}
              />
              <div class="space-y-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Optional notes about this payment…"
                  bind:value={formData.notes}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Summary Section -->
      <div class="space-y-4">
        <div
          class="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-500"
        >
          <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
          <p class="text-sm font-medium">
            Once submitted, this request cannot be modified. If you make a mistake, please create a
            new request and cancel the previous one.
          </p>
        </div>

        <div class="rounded-xl border border-brand/10 bg-brand/5 p-6">
          <div class="flex">
            <div>
              <p class="text-xs font-bold tracking-widest text-brand uppercase">Total Amount</p>
              <p class="text-3xl font-black text-brand tabular-nums">
                {formatCurrency(
                  (parseFloat(formData.waterFee) || 0) +
                    (parseFloat(formData.assocFee) || 0) +
                    (parseFloat(formData.maintenanceFee) || 0) +
                    (parseFloat(formData.miscFee) || 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Button
        size="lg"
        class="w-full gap-3 font-bold"
        onclick={handleSubmit}
        isLoading={isSubmitting}
        icon={HandCoins}
      >
        Submit Payment
      </Button>
    {/if}
  </div>
</div>
