<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { settings } from "$state/settings.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { StatisticCard } from "$components/ui/haone";
  import {
    RefreshCcw,
    TrendingUp,
    TrendingDown,
    Wallet,
    CircleDollarSign,
    FileSpreadsheet,
    ChartLine,
    ChartLineIcon,
    DownloadIcon
  } from "@lucide/svelte";
  import { formatAccounting } from "$utils/formatters";
  import { translateMop, translateTransactionType } from "$utils/translators";
  import { getJournalDateRange } from "$utils/parsers";
  import type { JournalRecord, ResidentRecord } from "$lib/types";
  import * as Table from "$ui/table";
  import * as Tabs from "$ui/tabs";
  import {
    computeFinancialReportData,
    fetchFinancialReportData
  } from "$reports/financial-report-pdf";
  import { getPaymentStatus } from "$api/controllers/resident-controller";
  import * as Chart from "$ui/chart";
  import { PieChart, LineChart, Tooltip } from "layerchart";

  let activeTab = $state<"summary" | "graphs">("summary");
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let allJournal = $state<JournalRecord[]>([]);
  let allAccounts = $state<ResidentRecord[]>([]);
  let availableMops = $state<{ value: string; label: string }[]>([]);
  let periodStart = $state("");
  let periodEnd = $state("");

  let periodCovered = $derived.by(() => {
    if (!periodStart || !periodEnd) {
      return "N/A";
    }
    try {
      const start = new Date(periodStart).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      const end = new Date(periodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      return `${start} to ${end}`;
    } catch (e) {
      return `${periodStart} to ${periodEnd}`;
    }
  });

  // Derived data computations using shared computeFinancialReportData
  let reportData = $derived(
    computeFinancialReportData(
      allJournal.filter((j) => {
        return j.period === settings.currentTerm.trim() && j.type !== "EOS";
      }),
      allAccounts.filter((r) => {
        return r.period === settings.currentTerm.trim();
      }),
      availableMops
    )
  );

  let processedJournal = $derived(reportData.processedJournal);
  let totalIncoming = $derived(
    processedJournal.reduce((s, j) => {
      return s + j.incoming;
    }, 0)
  );
  let totalOutgoing = $derived(
    processedJournal.reduce((s, j) => {
      return s + j.outgoing;
    }, 0)
  );
  let netBalance = $derived(totalIncoming - totalOutgoing);
  let mopSummary = $derived(reportData.mopSummary);
  let fundSummary = $derived({
    feeSummary: reportData.feeSummary,
    feeTypeMopSummary: reportData.feeTypeMopSummary
  });
  let waterColl = $derived(reportData.waterColl);
  let assocColl = $derived(reportData.assocColl);
  let maintenanceColl = $derived(reportData.maintenanceColl);

  const chartConfig = {
    value: { label: "Amount" },
    "chart-1": { label: "Group 1", color: "var(--chart-1)" },
    "chart-2": { label: "Group 2", color: "var(--chart-2)" },
    "chart-3": { label: "Group 3", color: "var(--chart-3)" },
    "chart-4": { label: "Group 4", color: "var(--chart-4)" },
    "chart-5": { label: "Group 5", color: "var(--chart-5)" }
  } as const;

  // Disbursements grouped by transaction type for the chart
  let disbursementChartData = $derived.by(() => {
    const groupMap: Record<string, number> = {};
    processedJournal.forEach((j) => {
      if (j.outgoing > 0) {
        const typeLabel = translateTransactionType(j.type) || j.type;
        groupMap[typeLabel] = (groupMap[typeLabel] || 0) + j.outgoing;
      }
    });

    const entries = Object.entries(groupMap)
      .map(([label, value]) => {
        return {
          label,
          value,
          percentage: totalOutgoing > 0 ? ((value / totalOutgoing) * 100).toFixed(1) + "%" : "0%"
        };
      })
      .sort((a, b) => {
        return b.value - a.value;
      });

    return entries.map((item, i) => {
      return {
        ...item,
        fill: `var(--chart-${(i % 5) + 1})`
      };
    });
  });

  // Balance trend line graph: running totals over time for Water, Assoc, and Misc
  let balanceTrendData = $derived.by(() => {
    let runningWater = 0;
    let runningAssoc = 0;
    let runningMaintenance = 0;
    let runningMisc = 0;

    const points = processedJournal.map((j, idx) => {
      const isWaived = j.type?.toUpperCase().includes("WAIVED");
      if (!isWaived) {
        runningWater += j.water;
        runningAssoc += j.assoc;
        runningMaintenance += j.maintenance || 0;
        runningMisc += j.misc;
      }

      let dateFormatted = j.date;
      if (j.date) {
        try {
          const d = new Date(j.date);
          if (!isNaN(d.getTime())) {
            dateFormatted = d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            });
          }
        } catch (e) {
          // ignore
        }
      }

      const total = runningWater + runningAssoc + runningMaintenance + runningMisc;

      return {
        id: j.id || `pt-${idx}`,
        index: idx + 1,
        date: dateFormatted,
        rawDate: j.date,
        balance: Math.round(total * 100) / 100,
        water: Math.round(runningWater * 100) / 100,
        assoc: Math.round(runningAssoc * 100) / 100,
        maintenance: Math.round(runningMaintenance * 100) / 100,
        misc: Math.round(runningMisc * 100) / 100
      };
    });

    return points;
  });

  const balanceTrendSeries = [
    { key: "balance", label: "Net Balance", color: "#10b981" },
    { key: "water", label: "Water Fee", color: "#06b6d4" },
    { key: "assoc", label: "Association Fee", color: "#3b82f6" },
    { key: "maintenance", label: "Maintenance & Gas Fee", color: "#8b5cf6" },
    { key: "misc", label: "Miscellaneous", color: "#f59e0b" }
  ];

  // Settlement status of residents for the term
  let settlementStatusData = $derived.by(() => {
    const currentAccounts = allAccounts.filter((r) => {
      return r.period === settings.currentTerm.trim();
    });
    const totalResidents = currentAccounts.length;
    if (totalResidents === 0) {
      return [];
    }

    const statusMap: Record<string, number> = {
      CLEARED: 0,
      OVERPAID: 0,
      FULLY_PAID: 0,
      HALF_FULLY_PAID: 0,
      PARTIALLY_PAID: 0,
      NO_PAYMENT: 0
    };

    currentAccounts.forEach((res) => {
      if (!res) {
        return;
      }
      const status = getPaymentStatus(res);
      if (status !== "NO_RECORD") {
        statusMap[status] = (statusMap[status] || 0) + 1;
      }
    });

    const statusLabels: Record<string, string> = {
      CLEARED: "Cleared",
      OVERPAID: "Overpaid",
      FULLY_PAID: "Fully Paid",
      HALF_FULLY_PAID: "Half-Fully Paid",
      PARTIALLY_PAID: "Partial Payment",
      NO_PAYMENT: "No Payment"
    };

    const statusColors: Record<string, string> = {
      CLEARED: "var(--chart-1)",
      OVERPAID: "var(--chart-2)",
      FULLY_PAID: "var(--chart-3)",
      HALF_FULLY_PAID: "var(--chart-4)",
      PARTIALLY_PAID: "var(--chart-5)",
      NO_PAYMENT: "#ef4444"
    };

    return Object.entries(statusMap)
      .filter(([_, count]) => count > 0)
      .map(([status, value]) => ({
        label: statusLabels[status] || status,
        value,
        percentage: ((value / totalResidents) * 100).toFixed(1) + "%",
        fill: statusColors[status] || "var(--chart-1)"
      }))
      .sort((a, b) => b.value - a.value);
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;

    try {
      const data = await fetchFinancialReportData(bypassCache);
      allJournal = data.allJournal;
      allAccounts = data.allAccounts;
      availableMops = data.availableMops;

      // Auto-Period
      const range = getJournalDateRange(processedJournal);
      if (range.start && range.end) {
        periodStart = range.start;
        periodEnd = range.end;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Financial Report";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Financial Report"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Export", href: "/admin/financial-report/export", icon: DownloadIcon }]}
  >
    {#snippet tabs()}
      <Tabs.Root bind:value={activeTab}>
        <Tabs.List>
          <Tabs.Trigger value="summary" class="flex items-center gap-1.5">
            <FileSpreadsheet class="h-3.5 w-3.5" />
            Summary
          </Tabs.Trigger>
          <Tabs.Trigger value="graphs" class="flex items-center gap-1.5">
            <ChartLine class="h-3.5 w-3.5" />
            Graphs
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        onclick={() => {
          return loadData();
        }}
        {isLoading}
        icon={RefreshCcw}>Try Again</Button
      >
    </ErrorView>
  {:else}
    <div class="space-y-6">
      <!-- (a) SUMMARY TAB -->
      {#if activeTab === "summary"}
        <div class="space-y-6">
          <!-- KPI Grid -->
          <div class="grid gap-4 sm:grid-cols-3">
            <StatisticCard title="Incoming" value={`₱${formatAccounting(totalIncoming)}`}>
              {#snippet icon()}<TrendingUp />{/snippet}
            </StatisticCard>

            <StatisticCard title="Outgoing" value={`₱${formatAccounting(totalOutgoing)}`}>
              {#snippet icon()}<Wallet />{/snippet}
            </StatisticCard>

            <StatisticCard title="Balance" value={`₱${formatAccounting(netBalance)}`}>
              {#snippet icon()}
                {#if netBalance >= 0}
                  <TrendingUp />
                {:else}
                  <TrendingDown />
                {/if}
              {/snippet}
            </StatisticCard>
          </div>

          <!-- ACCOUNT SUMMARY (Summary of Funds) -->
          <div class="space-y-3">
            <h3 class="text-base font-bold text-foreground uppercase">Account Summary</h3>

            <div class="space-y-6">
              <!-- Table 1: BY MODE OF PAYMENT -->
              <div class="overflow-hidden rounded-xl border">
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>BY MODE OF PAYMENT¹</Table.Head>
                      <Table.Head class="text-right">INCOMING</Table.Head>
                      <Table.Head class="text-right">OUTGOING</Table.Head>
                      <Table.Head class="text-right">BALANCE</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each Object.entries(mopSummary) as [mop, data]}
                      <Table.Row>
                        <Table.Cell class="uppercase"
                          >{availableMops.find((m) => m.value === mop)?.label ||
                            translateMop(mop)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell
                        >
                        <Table.Cell class="text-right"
                          >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                        >
                      </Table.Row>
                    {/each}
                    <Table.Row class="bg-muted/30 font-bold">
                      <Table.Cell>ENDING BALANCE</Table.Cell>
                      <Table.Cell class="text-right"></Table.Cell>
                      <Table.Cell class="text-right"></Table.Cell>
                      <Table.Cell class="text-right">{formatAccounting(netBalance)}</Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table.Root>
              </div>

              <!-- Table 2: BY FEE TYPE -->
              <div class="overflow-hidden rounded-xl border">
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>BY FEE TYPE¹</Table.Head>
                      <Table.Head class="text-right">INCOMING</Table.Head>
                      <Table.Head class="text-right">OUTGOING</Table.Head>
                      <Table.Head class="text-right">BALANCE</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    <!-- WATER FEE Group -->
                    <Table.Row class="font-bold">
                      <Table.Cell>WATER FEE</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.WATER.incoming)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.WATER.outgoing)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(
                          fundSummary.feeSummary.WATER.incoming -
                            fundSummary.feeSummary.WATER.outgoing
                        )}</Table.Cell
                      >
                    </Table.Row>
                    {#each Object.entries(fundSummary.feeTypeMopSummary.WATER) as [mop, data]}
                      <Table.Row>
                        <Table.Cell class="pl-6 uppercase"
                          >{availableMops.find((m) => m.value === mop)?.label ||
                            translateMop(mop)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell
                        >
                        <Table.Cell class="text-right"
                          >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                        >
                      </Table.Row>
                    {/each}

                    <!-- ASSOCIATION FEE Group -->
                    <Table.Row class="font-bold">
                      <Table.Cell>ASSOCIATION FEE</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.ASSOC.incoming)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.ASSOC.outgoing)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(
                          fundSummary.feeSummary.ASSOC.incoming -
                            fundSummary.feeSummary.ASSOC.outgoing
                        )}</Table.Cell
                      >
                    </Table.Row>
                    {#each Object.entries(fundSummary.feeTypeMopSummary.ASSOC) as [mop, data]}
                      <Table.Row>
                        <Table.Cell class="pl-6 uppercase"
                          >{availableMops.find((m) => m.value === mop)?.label ||
                            translateMop(mop)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell
                        >
                        <Table.Cell class="text-right"
                          >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                        >
                      </Table.Row>
                    {/each}

                    <!-- MAINTENANCE & GAS FEE Group -->
                    <Table.Row class="font-bold">
                      <Table.Cell>MAINTENANCE & GAS FEE</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.MAINTENANCE.incoming)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.MAINTENANCE.outgoing)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(
                          fundSummary.feeSummary.MAINTENANCE.incoming -
                            fundSummary.feeSummary.MAINTENANCE.outgoing
                        )}</Table.Cell
                      >
                    </Table.Row>
                    {#each Object.entries(fundSummary.feeTypeMopSummary.MAINTENANCE) as [
                      mop,
                      data
                    ]}
                      <Table.Row>
                        <Table.Cell class="pl-6 uppercase"
                          >{availableMops.find((m) => m.value === mop)?.label ||
                            translateMop(mop)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell
                        >
                        <Table.Cell class="text-right"
                          >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                        >
                      </Table.Row>
                    {/each}

                    <!-- MISCELLANEOUS Group -->
                    <Table.Row class="font-bold">
                      <Table.Cell>MISCELLANEOUS</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.MISC.incoming)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(fundSummary.feeSummary.MISC.outgoing)}</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(
                          fundSummary.feeSummary.MISC.incoming -
                            fundSummary.feeSummary.MISC.outgoing
                        )}</Table.Cell
                      >
                    </Table.Row>
                    {#each Object.entries(fundSummary.feeTypeMopSummary.MISC) as [mop, data]}
                      <Table.Row>
                        <Table.Cell class="pl-6 uppercase"
                          >{availableMops.find((m) => m.value === mop)?.label ||
                            translateMop(mop)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell
                        >
                        <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell
                        >
                        <Table.Cell class="text-right"
                          >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                        >
                      </Table.Row>
                    {/each}

                    <!-- ENDING BALANCE final row -->
                    <Table.Row class="bg-muted/30 font-bold">
                      <Table.Cell>ENDING BALANCE</Table.Cell>
                      <Table.Cell class="text-right"></Table.Cell>
                      <Table.Cell class="text-right"></Table.Cell>
                      <Table.Cell class="text-right">{formatAccounting(netBalance)}</Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table.Root>
              </div>
            </div>
          </div>

          <!-- COLLECTION SUMMARY -->
          <div class="space-y-3">
            <h3 class="text-base font-bold text-foreground uppercase">Collection Summary</h3>
            <div class="overflow-hidden rounded-xl border">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-45">CATEGORY</Table.Head>
                    <Table.Head>DETAILS</Table.Head>
                    <Table.Head class="text-right">AMOUNT</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <!-- WATER FEE Group -->
                  <Table.Row>
                    <Table.Cell
                      rowspan={waterColl.aquaAltria > 0 ? 10 : 9}
                      class="border-r align-middle font-bold">WATER FEE</Table.Cell
                    >
                    <Table.Cell class="text-foreground">TARGET</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(waterColl.target)}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell class="text-foreground">LESS: WAIVED</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(waterColl.waived)}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell class="text-foreground">TOTAL COLLECTION FROM RESIDENTS</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(waterColl.resident)}</Table.Cell
                    >
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell class="text-foreground">LESS: COLLECTION REFUNDS</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(waterColl.refunds)}</Table.Cell
                    >
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell class="text-foreground">TOTAL COLLECTION FROM UHO</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(waterColl.uho)}</Table.Cell>
                  </Table.Row>
                  <Table.Row class="bg-muted/30 font-bold">
                    <Table.Cell>TOTAL COLLECTION</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(
                        waterColl.resident - waterColl.refunds + waterColl.uho
                      )}</Table.Cell
                    >
                  </Table.Row>
                  <Table.Row class="font-bold">
                    <Table.Cell>OVERDUE ACCOUNTS²</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(waterColl.overdue)}</Table.Cell
                    >
                  </Table.Row>
                  {#if waterColl.aquaAltria > 0}
                    <Table.Row>
                      <Table.Cell class="text-foreground"
                        >PAID TO WATER SUPPLIER (AQUA ALTRIA)³</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(waterColl.aquaAltria)}</Table.Cell
                      >
                    </Table.Row>
                  {/if}
                  <Table.Row>
                    <Table.Cell class="text-foreground">PAID TO WATER SUPPLIER³</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(waterColl.paidToWater)}</Table.Cell
                    >
                  </Table.Row>
                  <Table.Row class="bg-muted/40 font-bold">
                    <Table.Cell>PAID TO WATER SUPPLIER (TOTAL)³</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(waterColl.aquaAltria + waterColl.paidToWater)}</Table.Cell
                    >
                  </Table.Row>

                  <!-- ASSOCIATION FEE Group -->
                  {#if assocColl.target > 0}
                    <Table.Row class="border-t">
                      <Table.Cell rowspan={5} class="border-r align-middle font-bold"
                        >ASSOCIATION FEE</Table.Cell
                      >
                      <Table.Cell class="text-foreground">TARGET</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(assocColl.target)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell class="text-foreground">LESS: WAIVED</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(assocColl.waived)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell class="text-foreground"
                        >TOTAL COLLECTION FROM RESIDENTS</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(assocColl.resident)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row class="font-bold">
                      <Table.Cell>LESS: COLLECTION REFUNDS</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(assocColl.resident - assocColl.refunds)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row class="font-bold">
                      <Table.Cell>OVERDUE ACCOUNTS²</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(assocColl.overdue)}</Table.Cell
                      >
                    </Table.Row>
                  {/if}

                  <!-- MAINTENANCE & GAS FEE Group -->
                  {#if maintenanceColl.target > 0}
                    <Table.Row class="border-t">
                      <Table.Cell rowspan={5} class="border-r align-middle font-bold"
                        >MAINTENANCE & GAS FEE</Table.Cell
                      >
                      <Table.Cell class="text-foreground">TARGET</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(maintenanceColl.target)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell class="text-foreground">LESS: WAIVED</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(maintenanceColl.waived)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell class="text-foreground"
                        >TOTAL COLLECTION FROM RESIDENTS</Table.Cell
                      >
                      <Table.Cell class="text-right"
                        >{formatAccounting(maintenanceColl.resident)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row class="font-bold">
                      <Table.Cell>LESS: COLLECTION REFUNDS</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(maintenanceColl.resident - maintenanceColl.refunds)}</Table.Cell
                      >
                    </Table.Row>
                    <Table.Row class="font-bold">
                      <Table.Cell>OVERDUE ACCOUNTS²</Table.Cell>
                      <Table.Cell class="text-right"
                        >{formatAccounting(maintenanceColl.overdue)}</Table.Cell
                      >
                    </Table.Row>
                  {/if}
                </Table.Body>
              </Table.Root>
            </div>
          </div>

          <!-- FOOTNOTES -->
          <div class="mt-6 space-y-1.5 border-t pt-6 text-xs leading-relaxed text-foreground/80">
            <p>
              ¹ Amounts may appear inflated due to internal transfers between accounts (e.g., Cash
              to GCash).
            </p>
            <p>
              ² Residents who have not settled their accounts by the due date and are considered to
              be in arrears.
            </p>
            <p>³ Period covered: {periodCovered} (excluding transaction fees).</p>
          </div>
        </div>
      {:else if activeTab === "graphs"}
        <div class="space-y-6">
          <!-- BALANCE TREND LINE CHART -->
          {#if balanceTrendData.length > 0}
            <Card.Root>
              <Card.Header>
                <Card.Title class="flex items-center gap-2 text-lg">
                  <ChartLineIcon class="h-5 w-5" />
                  Fee Balances Trend
                </Card.Title>
                <Card.Description
                  >Cumulative running balances for all funds held by the association across the term</Card.Description
                >
              </Card.Header>
              <Card.Content class="space-y-6">
                <div class="h-80 w-full">
                  <LineChart data={balanceTrendData} x="date" series={balanceTrendSeries}>
                    {#snippet tooltip({ context })}
                      <Tooltip.Root {context}>
                        <Tooltip.Header
                          value={context.tooltip.data?.rawDate || context.tooltip.data?.date || ""}
                        />
                        <Tooltip.List>
                          {#each context.tooltip.series.filter((s) => s.visible) as s}
                            {#if context.series.isHighlighted(s.key, true)}
                              <Tooltip.Item
                                label={s.label}
                                value={`₱${formatAccounting(s.value)}`}
                                color={s.color}
                                data-highlighted={context.series.isHighlighted(s.key, true)}
                                valueAlign="right"
                                onpointerenter={() => (context.series.highlightKey = s.key)}
                                onpointerleave={() => (context.series.highlightKey = null)}
                              />
                            {/if}
                          {/each}
                        </Tooltip.List>
                      </Tooltip.Root>
                    {/snippet}
                  </LineChart>
                </div>

                <div class="flex flex-wrap gap-3 pt-2">
                  {#each balanceTrendSeries as s}
                    <div
                      class="flex items-center gap-1.5 rounded-md border bg-muted/20 px-2.5 py-1 text-xs"
                    >
                      <span class="h-2.5 w-2.5 rounded-full" style="background-color: {s.color}"
                      ></span>
                      <span class="font-medium text-foreground">{s.label}</span>
                    </div>
                  {/each}
                </div>
              </Card.Content>
            </Card.Root>
          {/if}

          <!-- SETTLEMENT STATUS CARD -->
          {#if settlementStatusData.length > 0}
            <Card.Root>
              <Card.Header>
                <Card.Title class="flex items-center gap-2 text-lg">
                  <CircleDollarSign class="h-5 w-5" />
                  Settlement Status
                </Card.Title>
              </Card.Header>
              <Card.Content class="space-y-6">
                <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-75">
                  <PieChart
                    data={settlementStatusData}
                    key="label"
                    value="value"
                    c="fill"
                    innerRadius={-20}
                    cornerRadius={4}
                    padAngle={0.02}
                  />
                </Chart.Container>

                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {#each settlementStatusData as item}
                    <div
                      class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <div
                          class="h-2 w-2 rounded-full"
                          style="background-color: {item.fill}"
                        ></div>
                        <span
                          class="truncate text-xs font-semibold text-foreground/80"
                          title={item.label}>{item.label}</span
                        >
                      </div>
                      <div class="flex shrink-0 items-center gap-2">
                        <span class="text-xs font-bold text-foreground">{item.value}</span>
                        <span class="text-xs text-muted-foreground">({item.percentage})</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </Card.Content>
            </Card.Root>
          {/if}

          <!-- DISBURSEMENT BY TYPE CHART -->
          {#if disbursementChartData.length > 0}
            <Card.Root>
              <Card.Header>
                <Card.Title class="flex items-center gap-2 text-lg">
                  <TrendingDown class="h-5 w-5" />
                  Disbursements by Transaction Type
                </Card.Title>
              </Card.Header>
              <Card.Content class="space-y-6">
                <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-75">
                  <PieChart
                    data={disbursementChartData}
                    key="label"
                    value="value"
                    c="fill"
                    innerRadius={-20}
                    cornerRadius={4}
                    padAngle={0.02}
                  />
                </Chart.Container>

                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {#each disbursementChartData as item}
                    <div
                      class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <div
                          class="h-2 w-2 rounded-full"
                          style="background-color: {item.fill}"
                        ></div>
                        <span
                          class="truncate text-xs font-semibold text-foreground/80"
                          title={item.label}
                        >
                          {item.label}
                        </span>
                      </div>
                      <div class="flex shrink-0 items-center gap-2">
                        <span class="text-xs font-bold text-foreground"
                          >₱{formatAccounting(item.value)}</span
                        >
                        <span class="text-xs text-muted-foreground">({item.percentage})</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </Card.Content>
            </Card.Root>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
