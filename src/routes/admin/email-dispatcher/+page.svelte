<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import { emailDispatcher } from "$state/dispatcher.svelte";
  import { auth } from "$state/auth.svelte";
  import { createEmail, sendEmail } from "$api/services/gmail-service";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Progress } from "$ui/progress";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import RichTextEditor from "$components/editor/RichTextEditor.svelte";
  import { formatCurrency, formatAmount } from "$utils/formatters";
  import {
    Play,
    RefreshCcw,
    CircleCheckBig,
    ChevronLeft,
    ChevronRight,
    Eye,
    Mail,
    Trash2,
    Info,
    Settings2,
    Calculator,
    Users,
    TriangleAlert
  } from "@lucide/svelte";
  import { Checkbox } from "$ui/checkbox";
  import { Label } from "$ui/label";

  let isSending = $state(false);
  let isSuccess = $state(false);
  let error = $state<string | null>(null);
  let progress = $state(0);
  let previewIndex = $state(0);

  const currentEmail = $derived(emailDispatcher.queue[previewIndex]);

  const emailPreview = $derived.by(() => {
    if (!currentEmail) return { subject: "", body: "" };

    // Inject custom reminders if the data supports it
    const data = { ...currentEmail.data };
    if ("reminders" in data) {
      data.reminders = emailDispatcher.customReminders;
    }
    if ("warnReservationCancellation" in data) {
      data.warnReservationCancellation = emailDispatcher.warnReservationCancellation;
    }
    if ("warnClearance" in data) {
      data.warnClearance = emailDispatcher.warnClearance;
    }
    if ("hideBedNotice" in data) {
      data.hideBedNotice = emailDispatcher.hideBedNotice;
    }

    return {
      subject: currentEmail.template.subject(data, currentEmail.branding),
      body: currentEmail.template.generateHtml(data, currentEmail.branding)
    };
  });

  const batchSummary = $derived.by(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    emailDispatcher.queue.forEach((item) => {
      const items = (item.data as any).items || [];
      items.forEach((f: { name: string; amount: number }) => {
        totals[f.name] = (totals[f.name] || 0) + f.amount;
        grandTotal += f.amount;
      });
    });

    return {
      items: Object.entries(totals).map(([name, amount]) => ({ name, amount })),
      total: grandTotal
    };
  });

  async function runBatch() {
    if (!auth.accessToken) {
      error = "Authentication required. Please refresh or sign in again.";
      return;
    }

    isSending = true;
    isSuccess = false;
    error = null;
    progress = 0;

    const total = emailDispatcher.queue.length;
    let sent = 0;

    while (emailDispatcher.queue.length > 0) {
      const item = emailDispatcher.queue[0];
      try {
        const data = { ...item.data };
        if ("reminders" in data) {
          data.reminders = emailDispatcher.customReminders;
        }
        if ("warnReservationCancellation" in data) {
          data.warnReservationCancellation = emailDispatcher.warnReservationCancellation;
        }
        if ("warnClearance" in data) {
          data.warnClearance = emailDispatcher.warnClearance;
        }
        if ("hideBedNotice" in data) {
          data.hideBedNotice = emailDispatcher.hideBedNotice;
        }

        const body = item.template.generateHtml(data, item.branding);
        const subject = item.template.subject(data, item.branding);
        const raw = createEmail(item.to, subject, body, item.branding.replyTo);

        await sendEmail(auth.accessToken, raw);

        // Execute post-send logic if any (e.g., updating sheets)
        if (item.onSuccess) {
          await item.onSuccess();
        }

        // Remove the sent item so a mid-batch failure or refresh never
        // resends it; retry continues with the unsent remainder only.
        emailDispatcher.queue.splice(0, 1);
        sent += 1;
        if (previewIndex > 0) {
          previewIndex -= 1;
        }

        progress = total > 0 ? Math.round((sent / total) * 100) : 100;
        // Throttle to avoid rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (e: any) {
        error = `Failed at ${item.to}: ${e.message}`;
        isSending = false;
        return;
      }
    }

    emailDispatcher.clear();
    previewIndex = 0;
    progress = 100;
    isSuccess = true;
    isSending = false;
  }

  function handleDone() {
    isSuccess = false;
    error = null;
    progress = 0;
    previewIndex = 0;
  }

  function handleBack() {
    if (isSending) return;
    emailDispatcher.clear();
    window.history.back();
  }

  onMount(() => {
    pageState.title = "Email Dispatcher";
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Email Dispatcher"
    isTopLevel={true}
    actions={[
      {
        label: "Clear Queue",
        variant: "destructive",
        onclick: () => emailDispatcher.clear(),
        disabled: isSending || isSuccess || emailDispatcher.queue.length === 0,
        icon: Trash2
      },
      {
        label: isSuccess ? "Done" : isSending ? "Sending…" : "Run Batch",
        onclick: () => (isSuccess ? handleDone() : runBatch()),
        isLoading: isSending,
        disabled: isSending || (!isSuccess && emailDispatcher.queue.length === 0),
        icon: isSuccess ? CircleCheckBig : Play
      }
    ]}
  />

  {#if emailDispatcher.queue.length === 0 && !isSuccess}
    <EmptyView
      title="Queue is empty."
      description="Select records from Resident Directory or Pending Receipts to begin."
    >
      {#snippet icon()}
        <Mail class="h-8 w-8 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Info Panel -->
      <div class="space-y-6 lg:col-span-1">
        <Card.Root>
          <Card.Header class="pb-2">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Info class="h-5 w-5 text-primary" /> Batch Information
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            {#if !auth.isInstanceAdmin}
              <div
                class="mt-2 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3"
              >
                <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p class="text-xs">
                  These emails will be sent using your personal account and <strong
                    >not the hall association's</strong
                  >
                  account. Click <strong>Run Batch</strong> only if you are sure you want to send these
                  emails.
                </p>
              </div>
            {/if}
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Emails in Queue
              </p>
              <p class="text-2xl font-bold text-foreground">{emailDispatcher.queue.length}</p>
            </div>

            {#if isSending || isSuccess}
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs font-medium">
                  <span>Dispatch Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            {/if}

            {#if error}
              <ErrorView {error}>
                <Button
                  variant="outline"
                  size="sm"
                  class="mt-2"
                  onclick={runBatch}
                  isLoading={isSending}
                  icon={RefreshCcw}>Try Again</Button
                >
              </ErrorView>
            {/if}

            {#if isSuccess}
              <div
                class="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-xs font-bold text-green-700"
              >
                <CircleCheckBig class="h-4 w-4" />
                <span>All emails dispatched successfully.</span>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        {#if emailDispatcher.batchType === "REMINDER"}
          <Card.Root>
            <Card.Header class="pb-2">
              <Card.Title class="flex items-center gap-2 text-lg">
                <Settings2 class="h-5 w-5 text-primary" /> Blast Customization
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <RichTextEditor bind:content={emailDispatcher.customReminders} />
              <p class="mt-2 text-xs text-muted-foreground italic">
                Globally applied to this batch.
              </p>

              <Label
                class="mt-8 block text-xs font-bold tracking-widest text-muted-foreground uppercase"
              >
                NOTICE OPTIONS
              </Label>
              <div class="mt-2 flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div class="flex items-start gap-4">
                  <Checkbox
                    id="warn-reservation"
                    class="mt-0.5 h-5 w-5"
                    bind:checked={emailDispatcher.warnReservationCancellation}
                  />
                  <div class="space-y-1 leading-none">
                    <Label for="warn-reservation" class="flex items-center gap-2 text-sm font-bold">
                      Priority Reservation Warning
                    </Label>
                    <p class="text-xs leading-tight text-muted-foreground">
                      Warn residents with &lt; 50% payment about possible cancellation.
                    </p>
                  </div>
                </div>

                <div class="flex items-start gap-4 border-t border-border pt-6">
                  <Checkbox
                    id="warn-clearance"
                    class="mt-0.5 h-5 w-5"
                    bind:checked={emailDispatcher.warnClearance}
                  />
                  <div class="space-y-1 leading-none">
                    <Label for="warn-clearance" class="flex items-center gap-2 text-sm font-bold">
                      Clearance Warning
                    </Label>
                    <p class="text-xs leading-tight text-muted-foreground">
                      Warn residents that non-payment incurs accountability (Section 25).
                    </p>
                  </div>
                </div>

                <div class="flex items-start gap-4 border-t border-border pt-6">
                  <Checkbox
                    id="hide-bed"
                    class="mt-0.5 h-5 w-5"
                    bind:checked={emailDispatcher.hideBedNotice}
                  />
                  <div class="space-y-1 leading-none">
                    <Label for="hide-bed" class="flex items-center gap-2 text-sm font-bold">
                      Hide Bed Assignment Notice
                    </Label>
                    <p class="text-xs leading-tight text-muted-foreground">
                      Suppress the semestral registration form reminder for this batch.
                    </p>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        {/if}

        {#if emailDispatcher.batchType === "ACKNOWLEDGMENT" && batchSummary.items.length > 0}
          <Card.Root>
            <Card.Header class="pb-2">
              <Card.Title class="flex items-center gap-2 text-lg">
                <Calculator class="h-5 w-5 text-primary" /> Batch Fee Breakdown
              </Card.Title>
            </Card.Header>
            <Card.Content class="space-y-4">
              <div
                class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-muted/20"
              >
                {#each batchSummary.items as fee}
                  <div class="flex items-center justify-between px-4 py-3">
                    <span class="text-xs font-semibold text-muted-foreground">{fee.name}</span>
                    <span class="font-mono text-xs font-semibold text-foreground"
                      >{formatAmount(fee.amount)}</span
                    >
                  </div>
                {/each}
              </div>

              <div class="rounded-xl border border-border bg-muted/30 p-4">
                <p class="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                  Total Batch Confirmation
                </p>
                <p class="text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(batchSummary.total)}
                </p>
              </div>
            </Card.Content>
          </Card.Root>
        {/if}

        <Card.Root>
          <Card.Header class="pb-2">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Users class="h-5 w-5 text-primary" /> Recipients
            </Card.Title>
          </Card.Header>
          <Card.Content class="p-0">
            <div class="max-h-100 divide-y overflow-auto">
              {#each emailDispatcher.queue as item, i}
                <button
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 {previewIndex ===
                  i
                    ? 'border-l-4 border-primary bg-muted'
                    : ''}"
                  onclick={() => (previewIndex = i)}
                  disabled={isSending || isSuccess}
                >
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-xs font-bold">{item.recipientName}</span>
                    <span class="truncate text-xs text-muted-foreground">{item.to}</span>
                  </div>
                </button>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Preview Panel -->
      <div class="lg:col-span-2">
        <Card.Root>
          <Card.Header class="flex flex-row items-center justify-between">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Eye class="h-5 w-5" /> Email Preview
            </Card.Title>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                disabled={previewIndex === 0 || isSending || isSuccess}
                onclick={() => previewIndex--}
                icon={ChevronLeft}
              />
              <span class="text-xs font-bold tabular-nums"
                >{previewIndex + 1} / {emailDispatcher.queue.length}</span
              >
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                disabled={previewIndex === emailDispatcher.queue.length - 1 ||
                  isSending ||
                  isSuccess}
                onclick={() => previewIndex++}
                icon={ChevronRight}
              />
            </div>
          </Card.Header>
          <Card.Content>
            {#if currentEmail}
              <div class="mb-4 space-y-2 rounded-md border bg-muted/20 p-3">
                <div class="flex justify-between">
                  <span class="text-xs font-bold text-muted-foreground uppercase">Recipient</span>
                  <span class="text-xs font-bold text-foreground">{currentEmail.to}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-xs font-bold text-muted-foreground uppercase">Subject</span>
                  <span class="text-xs font-semibold text-foreground">{emailPreview.subject}</span>
                </div>
              </div>

              <div
                class="max-h-150 overflow-auto rounded-lg border bg-background text-foreground shadow-inner"
              >
                {@html emailPreview.body}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>
