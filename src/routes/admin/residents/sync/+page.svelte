<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { settings } from "$state/settings.svelte";
  import {
    getSyncPreview,
    applySync,
    declineRegistration,
    type SyncPreviewAction
  } from "$api/controllers/rooms-controller.svelte";
  import {
    sendRegistrationApprovedEmail,
    sendRegistrationOnHoldEmail
  } from "$api/controllers/registration-notification-controller";
  import { normalizeStudentNo } from "$utils/student-no";
  import { translateCollege, translatePeriod, translateProgram } from "$utils/translators";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import AdminResidentsTabs from "$components/tabs/AdminResidentsTabs.svelte";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Textarea } from "$ui/textarea";
  import * as AlertDialog from "$ui/alert-dialog";
  import { RefreshCcw, CircleCheck, CircleAlert, MoveRight, Check, X } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import Banner from "$components/content/Banner.svelte";

  let isLoading = $state(false);
  let processingIndex = $state<number | null>(null);
  let error = $state<string | null>(null);
  let previewActions = $state<SyncPreviewAction[]>([]);

  // Decline Dialog State
  let declineDialog = $state({
    open: false,
    email: "",
    residentName: "",
    currIndex: undefined as number | undefined,
    reason: "",
    isSubmitting: false
  });

  const groupedPreview = $derived.by(() => {
    const groups = new Map<number, SyncPreviewAction[]>();
    for (const action of previewActions) {
      const key = action.currIndex ?? -1;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(action);
    }
    return Array.from(groups.entries()).map(([currIndex, actions]) => ({
      currIndex,
      actions
    }));
  });

  async function loadPreview() {
    isLoading = true;
    error = null;
    try {
      if (!settings.activeTerm) {
        error = "Active academic term (TERM_CURR) not found.";
        return;
      }
      previewActions = await getSyncPreview(settings.activeTerm);
    } catch (e: any) {
      error = e.message || "Failed to load sync preview.";
    } finally {
      isLoading = false;
    }
  }

  async function handleApproveSingle(group: { currIndex: number; actions: SyncPreviewAction[] }) {
    processingIndex = group.currIndex;
    try {
      await applySync(group.actions, settings.activeTerm);
      const residentName = group.actions[0]?.residentName || "resident";
      toast.success(`Approved registration for ${residentName}`);
      const email = (group.actions[0]?.email || "").trim();
      if (email) {
        try {
          await sendRegistrationApprovedEmail(email, residentName);
        } catch (e: any) {
          toast.warning(`Approved, but the notification email failed: ${e.message}`);
        }
      }
      await loadPreview();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve registration.");
    } finally {
      processingIndex = null;
    }
  }

  function openDeclineDialog(primaryAction: SyncPreviewAction) {
    declineDialog = {
      open: true,
      email: primaryAction.email,
      residentName: primaryAction.residentName,
      currIndex: primaryAction.currIndex,
      reason: "",
      isSubmitting: false
    };
  }

  async function handleConfirmDecline() {
    if (!declineDialog.email || !declineDialog.reason.trim()) {
      return;
    }
    declineDialog.isSubmitting = true;
    try {
      const reason = declineDialog.reason.trim();
      await declineRegistration(
        declineDialog.email,
        settings.activeTerm,
        reason,
        declineDialog.currIndex
      );
      toast.success(`Declined registration for ${declineDialog.residentName}`);
      try {
        await sendRegistrationOnHoldEmail(declineDialog.email, declineDialog.residentName, reason);
      } catch (e: any) {
        toast.warning(`Declined, but the notification email failed: ${e.message}`);
      }
      declineDialog.open = false;
      await loadPreview();
    } catch (e: any) {
      toast.error(e.message || "Failed to decline registration.");
    } finally {
      declineDialog.isSubmitting = false;
    }
  }

  onMount(() => {
    pageState.title = "Sync Registrations";
    loadPreview();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Residents"
    isTopLevel={true}
    onRefresh={() => loadPreview()}
    isRefreshing={isLoading}
  >
    {#snippet tabs()}
      <AdminResidentsTabs active="sync" />
    {/snippet}
  </ContentHeader>

  {#if settings.currentTerm !== settings.activeTerm}
    <Banner variant="warning">
      <p>
        The selected term is <strong>{translatePeriod(settings.currentTerm)}</strong>, but changes
        only apply to the active term (<strong>{translatePeriod(settings.activeTerm)}</strong>).
        Switch to the active term in settings to proceed.
      </p>
    </Banner>
  {:else if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadPreview()} class="mt-4" {isLoading} icon={RefreshCcw}>
        Retry
      </Button>
    </ErrorView>
  {:else if groupedPreview.length === 0}
    <EmptyView
      title="All records are up to date."
      description="No pending changes between registrations and resident records."
    >
      {#snippet icon()}
        <CircleCheck class="h-8 w-8 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    <div class="space-y-4">
      <div class="space-y-3">
        {#each groupedPreview as group}
          {@const primaryAction = group.actions[0]}
          {@const isEntryProcessing = processingIndex === group.currIndex}
          <div class="rounded-xl border border-border bg-muted/20">
            <div class="flex items-start gap-3 p-4">
              <div class="min-w-0 flex-1 space-y-3">
                <!-- Header: Name + Account Type + Action Buttons -->
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-bold text-foreground">{primaryAction.residentName}</p>
                    {#if primaryAction.accountType}
                      <Badge variant="outline" class="text-xs font-bold tracking-tighter uppercase">
                        {primaryAction.accountType}
                      </Badge>
                    {/if}
                  </div>

                  <!-- Entry Action Buttons -->
                  <div class="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => handleApproveSingle(group)}
                      isLoading={isEntryProcessing}
                      disabled={processingIndex !== null}
                      icon={Check}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => openDeclineDialog(primaryAction)}
                      disabled={processingIndex !== null}
                      icon={X}
                    >
                      Decline
                    </Button>
                  </div>
                </div>

                <!-- Details grid -->
                <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  {#if primaryAction.email}
                    <div>
                      <span class="font-semibold text-muted-foreground">Email</span>
                      <p class="truncate font-medium text-foreground">{primaryAction.email}</p>
                    </div>
                  {/if}
                  {#if primaryAction.studentNo}
                    <div>
                      <span class="font-semibold text-muted-foreground">Student No.</span>
                      <p class="font-medium text-foreground">
                        {normalizeStudentNo(primaryAction.studentNo)}
                      </p>
                    </div>
                  {/if}
                  {#if primaryAction.college}
                    <div>
                      <span class="font-semibold text-muted-foreground">College</span>
                      <p class="font-medium text-foreground">
                        {translateCollege(primaryAction.college).join(", ")}
                      </p>
                    </div>
                  {/if}
                  {#if primaryAction.program}
                    <div class="col-span-2 sm:col-span-1">
                      <span class="font-semibold text-muted-foreground">Program</span>
                      <p class="font-medium text-foreground">
                        {translateProgram(primaryAction.program).join(", ")}
                      </p>
                    </div>
                  {/if}
                  {#if primaryAction.room && primaryAction.room !== "NONE" && primaryAction.room !== "N/A"}
                    <div>
                      <span class="font-semibold text-muted-foreground">Room / Bed</span>
                      <p class="font-medium text-foreground">
                        {primaryAction.room}{#if primaryAction.bed && primaryAction.bed !== "NONE" && primaryAction.bed !== "N/A"}-{primaryAction.bed}{/if}
                      </p>
                    </div>
                  {/if}
                  {#if primaryAction.checkInDate}
                    <div>
                      <span class="font-semibold text-muted-foreground">Check-in</span>
                      <p class="font-medium text-foreground">{primaryAction.checkInDate}</p>
                    </div>
                  {/if}
                </div>

                <!-- Actions -->
                <div class="space-y-1.5 border-t border-border/50 pt-2">
                  {#each group.actions as action}
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant={action.type.startsWith("CREATE") ? "default" : "outline"}
                        class="shrink-0 text-xs font-bold tracking-tighter uppercase"
                      >
                        {action.type.replace("_", " ")}
                      </Badge>
                      <span class="text-muted-foreground">{action.details}</span>
                      {#if action.from}
                        <Badge variant="secondary" class="bg-muted text-xs font-bold">
                          {action.from}
                        </Badge>
                      {/if}
                      {#if action.from && action.to}
                        <MoveRight class="h-3 w-3 text-muted-foreground" />
                      {/if}
                      {#if action.to}
                        <Badge
                          variant="secondary"
                          class="bg-primary/10 text-xs font-bold text-primary"
                        >
                          {action.to}
                        </Badge>
                      {/if}
                    </div>
                    {#if action.warning}
                      <p
                        class="flex items-center gap-1 text-xs font-bold text-destructive uppercase"
                      >
                        <CircleAlert class="h-3 w-3" />
                        {action.warning}
                      </p>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Decline Dialog -->
<AlertDialog.Root
  open={declineDialog.open}
  onOpenChange={(v) => {
    if (!declineDialog.isSubmitting) {
      declineDialog.open = v;
    }
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Decline Registration</AlertDialog.Title>
      <AlertDialog.Description>
        State the reason for declining the registration of <strong
          >{declineDialog.residentName}</strong
        >
        ({declineDialog.email}). This reason will be shown on the resident's onboarding page.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <div class="py-2">
      <Textarea
        bind:value={declineDialog.reason}
        placeholder="e.g., Selected room is full, please choose another room or transient residency."
        rows={3}
        class="w-full"
      />
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={declineDialog.isSubmitting}>Cancel</AlertDialog.Cancel>
      <Button
        variant="destructive"
        onclick={handleConfirmDecline}
        isLoading={declineDialog.isSubmitting}
        disabled={!declineDialog.reason.trim()}
      >
        Decline
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
