<script lang="ts">
  import { onMount } from "svelte";
  import { settings } from "$state/settings.svelte";
  import { auth } from "$state/auth.svelte";
  import { page } from "$app/state";
  import { fetchTerms, fetchMopTypes } from "$api/controllers/constants-controller";
  import { translatePeriod, translateMop } from "$utils/translators";
  import { formatAccounting } from "$utils/formatters";
  import { isNextSemester } from "$utils/sort";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { ArrowRightLeft, CheckCircle2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { globalDialog } from "$state/dialog.svelte";
  import { Badge } from "$ui/badge";

  type SummaryRow = {
    mop: string;
    water: number;
    assoc: number;
    maintenance: number;
    misc: number;
    total: number;
  };
  type SkipRow = { mop: string; reason: string };

  let terms = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let sourceTerm = $state("");
  let targetTerm = $state("");
  let isLoading = $state(true);
  let isPreviewing = $state(false);
  let isSaving = $state(false);
  let error = $state<string | null>(null);
  let result = $state<{ summary: SummaryRow[]; skipped: SkipRow[] } | null>(null);

  function getWeight(term: string) {
    const match = /^(\d{2})(\d{2})_(MY|[1-3]S)$/.exec(term || "");
    if (!match) {
      return 0;
    }
    const year = parseInt(match[1], 10);
    const termPart = match[3];
    const termWeight = termPart === "MY" ? 3 : termPart === "2S" ? 2 : termPart === "1S" ? 1 : 0;
    return year * 10 + termWeight;
  }

  const targetOptions = $derived(
    sourceTerm
      ? terms
          .filter((t) => isNextSemester(sourceTerm, t.value))
          .map((t) => ({ value: t.value, label: t.label }))
      : []
  );

  function mopLabel(mop: string) {
    return (
      mopTypes.find((t) => t.value.toUpperCase() === mop.toUpperCase())?.label ||
      translateMop(mop) ||
      mop
    );
  }

  function termLabel(term: string) {
    return terms.find((t) => t.value === term)?.label || translatePeriod(term) || term;
  }

  onMount(async () => {
    isLoading = true;
    error = null;
    try {
      const [termRecords, mops] = await Promise.all([fetchTerms(), fetchMopTypes()]);
      mopTypes = mops;
      const values = termRecords
        .map((t) => ({
          value: t.value,
          label: t.description || translatePeriod(t.value) || t.value
        }))
        .sort((a, b) => getWeight(a.value) - getWeight(b.value));
      terms = values;

      const current = settings.currentTerm;
      sourceTerm = current || "";
      if (values.length > 0 && !values.some((t) => t.value === sourceTerm)) {
        sourceTerm = values[0].value;
      }
      const first = values.find((t) => isNextSemester(sourceTerm, t.value));
      const targetParam = page.url.searchParams.get("target");
      const paramIsValid =
        !!targetParam &&
        values.some(
          (t) => t.value === targetParam && isNextSemester(sourceTerm, targetParam)
        );
      targetTerm = paramIsValid ? targetParam : (first?.value ?? "");
    } catch (e: any) {
      error = e.message || "Failed to load terms.";
    } finally {
      isLoading = false;
    }
  });

  async function getSupabaseToken(): Promise<string | null> {
    const { supabase } = await import("$api/services/common");
    if (!supabase) {
      return null;
    }
    const { data: sbSession } = await supabase.auth.getSession();
    return sbSession?.session?.access_token ?? null;
  }

  async function callCarryOver(dryRun: boolean) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.credentialJwt}`,
      "Content-Type": "application/json"
    };
    const token = await getSupabaseToken();
    if (token) {
      headers["x-supabase-access-token"] = token;
    }
    const resp = await fetch("/api/admin/transactions/carry-over", {
      method: "POST",
      headers,
      body: JSON.stringify({ sourceTerm, targetTerm, dryRun })
    });
    return await resp.json();
  }

  async function handlePreview() {
    if (!sourceTerm || !targetTerm) {
      toast.error("Select a source and target term first.");
      return;
    }
    isPreviewing = true;
    error = null;
    try {
      const data = await callCarryOver(true);
      if (!data.success) {
        throw new Error(data.error || "Failed to preview");
      }
      result = { summary: data.summary, skipped: data.skipped };
      if (data.summary.length === 0) {
        toast.info(
          data.skipped.length > 0
            ? "Nothing to carry — funds for these methods of payment were already carried."
            : "Nothing to carry over for this source term."
        );
      }
    } catch (e: any) {
      error = e.message;
      result = null;
    } finally {
      isPreviewing = false;
    }
  }

  function handleSave() {
    if (!result || result.summary.length === 0) {
      toast.error("Nothing to save. Run a preview first.");
      return;
    }
    const count = result.summary.length;
    globalDialog.confirm(
      "Carry over funds?",
      `This will close ${count} fund balance(s) in ${termLabel(sourceTerm)} and reopen them in ${termLabel(targetTerm)} as a CARRYOVER entry each. You can review the entries afterward in the Transactions page.`,
      undefined,
      async () => {
        isSaving = true;
        error = null;
        try {
          const data = await callCarryOver(false);
          if (!data.success) {
            throw new Error(data.error || "Failed to save");
          }
          toast.success(
            `Carried over ${data.summary.length} fund balance(s) from ${termLabel(sourceTerm)} to ${termLabel(targetTerm)}.`
          );
          result = { summary: [], skipped: data.skipped };
          await handlePreview();
        } catch (e: any) {
          error = e.message;
        } finally {
          isSaving = false;
        }
      }
    );
  }

  const grandTotal = $derived(result?.summary.reduce((sum, r) => sum + r.total, 0) ?? 0);
</script>

<div class="mx-auto max-w-4xl space-y-3">
  <ContentHeader title="Carry Over Funds" isTopLevel={false} />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error} />
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>End of Term Settlement</Card.Title>
        <Card.Description>
          Close each fund (method of payment) balance from the source term and reopen it at the
          start of the next semester as a CARRYOVER entry.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="grid gap-4">
          <div class="grid gap-2">
            <Label>Source Term</Label>
            <Combobox
              value={sourceTerm}
              options={terms.map((t) => ({ value: t.value, label: t.label }))}
              disabled={true}
            />
          </div>
          <div class="grid gap-2">
            <Label>Target Term</Label>
            <Combobox
              bind:value={targetTerm}
              options={targetOptions.map((t) => ({ value: t.value, label: t.label }))}
              placeholder="Select a later term..."
              onSelect={() => (result = null)}
            />
            {#if targetOptions.length === 0}
              <p class="text-xs text-muted-foreground">
                No following semester exists. Create the next semester under Academic Terms.
              </p>
            {/if}
          </div>
          <Button onclick={handlePreview} disabled={isPreviewing || !sourceTerm || !targetTerm}>
            <ArrowRightLeft class="size-4" />
            {isPreviewing ? "Computing..." : "Preview Carry Over"}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>

    {#if result}
      <Card.Root>
        <Card.Header>
          <Card.Title>
            {termLabel(sourceTerm)} → {termLabel(targetTerm)}
          </Card.Title>
          <Card.Description>
            {result.summary.length > 0
              ? `${result.summary.length} fund balance(s) will be carried over.`
              : "No fund balances to carry over."}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {#if result.summary.length > 0}
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-muted-foreground">
                    <th class="py-2 pr-4 font-medium">Mode of Payment</th>
                    <th class="py-2 pr-4 text-right font-medium">Water</th>
                    <th class="py-2 pr-4 text-right font-medium">Assoc</th>
                    <th class="py-2 pr-4 text-right font-medium">Maintenance</th>
                    <th class="py-2 pr-4 text-right font-medium">Misc</th>
                    <th class="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {#each result.summary as row (row.mop)}
                    <tr class="border-b last:border-0">
                      <td class="py-2 pr-4 font-medium">{mopLabel(row.mop)}</td>
                      <td class="py-2 pr-4 text-right tabular-nums"
                        >{formatAccounting(row.water)}</td
                      >
                      <td class="py-2 pr-4 text-right tabular-nums"
                        >{formatAccounting(row.assoc)}</td
                      >
                      <td class="py-2 pr-4 text-right tabular-nums"
                        >{formatAccounting(row.maintenance)}</td
                      >
                      <td class="py-2 pr-4 text-right tabular-nums">{formatAccounting(row.misc)}</td
                      >
                      <td class="py-2 text-right font-semibold tabular-nums"
                        >{formatAccounting(row.total)}</td
                      >
                    </tr>
                  {/each}
                </tbody>
                <tfoot>
                  <tr class="border-t">
                    <td class="py-2 pr-4 font-semibold">Total</td>
                    <td class="py-2 pr-4 text-right tabular-nums"></td>
                    <td class="py-2 pr-4 text-right tabular-nums"></td>
                    <td class="py-2 pr-4 text-right tabular-nums"></td>
                    <td class="py-2 pr-4 text-right tabular-nums"></td>
                    <td class="py-2 text-right font-semibold tabular-nums"
                      >{formatAccounting(grandTotal)}</td
                    >
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="mt-4 flex items-center gap-2">
              <Button onclick={handleSave} disabled={isSaving}>
                <CheckCircle2 class="size-4" />
                {isSaving ? "Saving..." : "Confirm & Carry Over"}
              </Button>
              <p class="text-xs text-muted-foreground">
                Adds one EOS (negative) entry in {termLabel(sourceTerm)} and one CARRYOVER (positive)
                entry in {termLabel(targetTerm)} per mode of payment.
              </p>
            </div>
          {:else}
            <EmptyView
              title="Everything is settled"
              description="No fund balances remain in the source term that aren't already carried over."
            />
          {/if}

          {#if result.skipped.length > 0}
            <div class="mt-4 space-y-1 border-t pt-3">
              <p class="text-xs font-medium text-muted-foreground">
                Already carried over (skipped)
              </p>
              {#each result.skipped as s (s.mop + s.reason)}
                <div class="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{mopLabel(s.mop)}</Badge>
                  <span class="text-muted-foreground">{s.reason}</span>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</div>
