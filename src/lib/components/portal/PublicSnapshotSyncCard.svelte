<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { settings } from "$state/settings.svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { formatAccounting } from "$utils/formatters";
  import { translatePeriod } from "$utils/translators";
  import { RefreshCw, ShieldCheck, UploadCloud } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  type Preview = {
    period: string;
    journalSourceCount: number;
    journalCount: number;
    journalExcludedCount: number;
    officerSourceCount: number;
    officerCount: number;
    officerExcludedCount: number;
    totals: {
      water: number;
      assoc: number;
      maintenance: number;
      gas: number;
      misc: number;
      balance: number;
    };
  };

  type SyncResult = {
    success: true;
    schema_version: 1;
    period: string;
    journal_count: number;
    officer_count: number;
    synced_at: string;
  };

  let configured = $state<boolean | null>(null);
  let configurationError = $state<string | null>(null);
  let checkedCredential = $state<string | null>(null);
  let isPreviewing = $state(false);
  let isSyncing = $state(false);
  let preview = $state<Preview | null>(null);
  let lastResult = $state<SyncResult | null>(null);

  class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  async function api<T>(method: "GET" | "PUT" | "POST"): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (!auth.credentialJwt) {
      throw new Error("Your HAOne admin session is unavailable. Please sign in again.");
    }
    headers.Authorization = `Bearer ${auth.credentialJwt}`;
    // Some local/mobile browser paths can omit Authorization while retaining
    // custom same-origin headers. The API verifies this same signed credential.
    headers["x-haone-credential"] = auth.credentialJwt;

    const { supabase } = await import("$api/services/common");
    const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: null };
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Your database session is unavailable. Please sign in again.");
    headers["x-supabase-access-token"] = token;

    const response = await fetch("/api/admin/public-ledger", {
      method,
      headers,
      ...(method === "GET" ? {} : { body: JSON.stringify({ period: settings.activeTerm }) })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(data?.error || "The public portal request failed.", response.status);
    }
    return data as T;
  }

  async function loadConfiguration() {
    if (!auth.credentialJwt) return;
    configurationError = null;
    configured = null;
    try {
      const result = await api<{ configured: boolean }>("GET");
      configured = result.configured;
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 401) {
        configurationError = "Your HAOne admin session has expired. Sign in again to continue.";
      } else if (error instanceof ApiError && error.status === 403) {
        configurationError = "Your account is not authorized to publish portal data.";
      } else {
        configurationError = error?.message || "Could not check the portal configuration.";
      }
    }
  }

  async function previewSnapshot() {
    isPreviewing = true;
    try {
      preview = await api<Preview>("PUT");
      toast.success("Public snapshot preview is ready.");
    } catch (error: any) {
      toast.error(error?.message || "Could not preview the public snapshot.");
    } finally {
      isPreviewing = false;
    }
  }

  async function publishSnapshot() {
    isSyncing = true;
    try {
      const response = await api<Preview & { success: true; result: SyncResult }>("POST");
      preview = response;
      lastResult = response.result;
      toast.success(
        `Published ${response.journalCount} transactions and ${response.officerCount} officers.`
      );
    } catch (error: any) {
      toast.error(error?.message || "Could not synchronize the public snapshot.");
    } finally {
      isSyncing = false;
    }
  }

  function confirmPublish() {
    globalDialog.confirm(
      "Replace the public portal snapshot?",
      `This will replace the portal's journal and officer data with the redacted snapshot for ${translatePeriod(settings.activeTerm)}.`,
      undefined,
      publishSnapshot,
      undefined,
      { accept: "Sync to Public Ledger", cancel: "Cancel" }
    );
  }

  $effect(() => {
    const credential = auth.credentialJwt;
    if (credential && credential !== checkedCredential) {
      checkedCredential = credential;
      loadConfiguration();
    }
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <ShieldCheck class="size-4 text-brand" />
      Public Portal Snapshot
    </Card.Title>
    <Card.Description>
      Publish redacted journal and officer records to the NFRH public portal.
    </Card.Description>
  </Card.Header>

  <Card.Content class="space-y-5">
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg border bg-muted/20 p-3">
        <p class="text-xs font-medium text-muted-foreground">Official active term</p>
        <p class="mt-1 text-sm font-semibold">
          {settings.activeTerm ? translatePeriod(settings.activeTerm) : "Not available"}
        </p>
      </div>
      <div class="rounded-lg border bg-muted/20 p-3">
        <p class="text-xs font-medium text-muted-foreground">Destination</p>
        <p class="mt-1 text-sm font-semibold">
          {#if configured === null}
            Checking…
          {:else if configured}
            Configured
          {:else if configurationError}
            Unavailable
          {:else}
            Not configured
          {/if}
        </p>
      </div>
    </div>

    {#if configured === false}
      <p class="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Configure <code>SECONDARY_SUPABASE_URL</code> and
        <code>SECONDARY_SUPABASE_SERVICE_ROLE_KEY</code> on the HAOne server to enable publishing.
      </p>
    {/if}

    {#if configurationError}
      <p
        class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      >
        {configurationError}
      </p>
    {/if}

    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={previewSnapshot}
        disabled={!settings.activeTerm || isSyncing}
        isLoading={isPreviewing}
        icon={RefreshCw}
      >
        Preview
      </Button>
      <Button
        size="sm"
        onclick={confirmPublish}
        disabled={!settings.activeTerm || !configured || isPreviewing}
        isLoading={isSyncing}
        icon={UploadCloud}
      >
        Sync to Public Ledger
      </Button>
    </div>

    {#if preview}
      <div class="space-y-3 rounded-lg border p-4 text-sm">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="font-medium">Journal records</p>
            <p class="text-muted-foreground">
              {preview.journalCount} included · {preview.journalExcludedCount} excluded
            </p>
          </div>
          <div>
            <p class="font-medium">Officers</p>
            <p class="text-muted-foreground">
              {preview.officerCount} included · {preview.officerExcludedCount} excluded
            </p>
          </div>
        </div>
        <div class="border-t pt-3">
          <p class="text-xs text-muted-foreground">Calculated public balance</p>
          <p class="font-semibold tabular-nums">{formatAccounting(preview.totals.balance)}</p>
        </div>
      </div>
    {/if}

    {#if lastResult}
      <div class="rounded-lg bg-brand/5 p-3 text-sm">
        <p class="font-medium text-brand">Last synchronization succeeded</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {new Date(lastResult.synced_at).toLocaleString()} · {lastResult.journal_count} journal records
          · {lastResult.officer_count} officers
        </p>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
