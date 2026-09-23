import { fetchMopTypes } from "$api/controllers/constants-controller";
import { fetchJournalEntries } from "$api/controllers/journal-controller";
import { fetchResidents } from "$api/controllers/resident-controller";
import { TransactionType, type JournalRecord, type ResidentRecord } from "$lib/types";
import { brandingState } from "$state/branding.svelte";
import { formatAccounting } from "$utils/formatters";
import { parseDateWeight } from "$utils/parsers";
import { translateMop } from "$utils/translators";
import type {
  Alignment,
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions
} from "pdfmake/interfaces";
import { getPdfMake, imgToDataUrl } from "./pdf-utils";

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

export interface FinancialReportOptions {
  journal: JournalRecord[];
  accounts: ResidentRecord[];
  semester: string;
  brandingKey: string;
  issuedBy: string;
  assessedBy: string;
  certifiedBy: string;
  periodCovered: string;
  availableMops: { value: string; label: string }[];
}

export async function fetchFinancialReportData(bypassCache = false) {
  const [entries, mappedAccounts, mops] = await Promise.all([
    fetchJournalEntries(undefined, undefined, bypassCache),
    fetchResidents(bypassCache),
    fetchMopTypes(bypassCache)
  ]);

  const list = Array.isArray(entries) ? entries : entries.items;

  // Fetch Journal
  const allJournal = list.map((res: JournalRecord) => ({
    ...res,
    dateWeight: parseDateWeight(res.date)
  }));

  const availableMops = mops;

  // Fetch Accounts
  const allAccounts = mappedAccounts;

  return {
    allJournal,
    allAccounts,
    availableMops
  };
}

export function computeFinancialReportData(
  journal: JournalRecord[],
  accounts: ResidentRecord[],
  availableMops: { value: string; label: string }[]
) {
  // 1. Sort Journal chronologically
  const sortedJournal = [...journal].sort(
    (a, b) =>
      (a.dateWeight ?? 0) - (b.dateWeight ?? 0) || (a.ledgerIndex ?? 0) - (b.ledgerIndex ?? 0)
  );

  // 2. Data Processing
  let runningBalance = 0;
  const processedJournal = sortedJournal.map((j) => {
    const isWaived = j.type.toUpperCase().includes("WAIVED");
    const amount = j.water + j.assoc + (j.maintenance || 0) + j.misc;
    const incoming = !isWaived && amount > 0 ? amount : 0;
    const outgoing = !isWaived && amount < 0 ? Math.abs(amount) : 0;
    if (!isWaived) {
      runningBalance += amount;
    }
    return {
      ...j,
      incoming,
      outgoing,
      runningBalance
    };
  }) as (JournalRecord & { incoming: number; outgoing: number; runningBalance: number })[];

  // Summary by MOP
  const mopSummary: Record<string, { incoming: number; outgoing: number }> = {};
  availableMops.forEach((m) => {
    mopSummary[m.value] = { incoming: 0, outgoing: 0 };
  });

  processedJournal.forEach((j) => {
    const rawMop = (j.mop || "").trim().toUpperCase();
    if (rawMop === "N/A") return;

    // Map to normalized key if possible, else use raw
    const key = rawMop || "CASH";
    if (!mopSummary[key]) mopSummary[key] = { incoming: 0, outgoing: 0 };
    mopSummary[key].incoming += j.incoming;
    mopSummary[key].outgoing += j.outgoing;
  });

  // Summary by Fee Type
  const feeSummary = {
    WATER: { incoming: 0, outgoing: 0 },
    ASSOC: { incoming: 0, outgoing: 0 },
    MAINTENANCE: { incoming: 0, outgoing: 0 },
    MISC: { incoming: 0, outgoing: 0 }
  };

  // Summary by Fee Type and MOP
  const feeTypeMopSummary = {
    WATER: {} as Record<string, { incoming: number; outgoing: number }>,
    ASSOC: {} as Record<string, { incoming: number; outgoing: number }>,
    MAINTENANCE: {} as Record<string, { incoming: number; outgoing: number }>,
    MISC: {} as Record<string, { incoming: number; outgoing: number }>
  };

  processedJournal.forEach((j) => {
    const isWaived = j.type.toUpperCase().includes("WAIVED");
    if (isWaived) {
      return;
    }
    const rawMop = (j.mop || "").trim().toUpperCase();
    if (rawMop === "N/A") {
      return;
    }
    const mopKey = rawMop || "CASH";

    if (j.water !== 0) {
      if (j.water > 0) {
        feeSummary.WATER.incoming += j.water;
        if (!feeTypeMopSummary.WATER[mopKey]) {
          feeTypeMopSummary.WATER[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.WATER[mopKey].incoming += j.water;
      } else {
        const absVal = Math.abs(j.water);
        feeSummary.WATER.outgoing += absVal;
        if (!feeTypeMopSummary.WATER[mopKey]) {
          feeTypeMopSummary.WATER[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.WATER[mopKey].outgoing += absVal;
      }
    }

    if (j.assoc !== 0) {
      if (j.assoc > 0) {
        feeSummary.ASSOC.incoming += j.assoc;
        if (!feeTypeMopSummary.ASSOC[mopKey]) {
          feeTypeMopSummary.ASSOC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.ASSOC[mopKey].incoming += j.assoc;
      } else {
        const absVal = Math.abs(j.assoc);
        feeSummary.ASSOC.outgoing += absVal;
        if (!feeTypeMopSummary.ASSOC[mopKey]) {
          feeTypeMopSummary.ASSOC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.ASSOC[mopKey].outgoing += absVal;
      }
    }

    const maintenanceAmt = j.maintenance || 0;
    if (maintenanceAmt !== 0) {
      if (maintenanceAmt > 0) {
        feeSummary.MAINTENANCE.incoming += maintenanceAmt;
        if (!feeTypeMopSummary.MAINTENANCE[mopKey]) {
          feeTypeMopSummary.MAINTENANCE[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.MAINTENANCE[mopKey].incoming += maintenanceAmt;
      } else {
        const absVal = Math.abs(maintenanceAmt);
        feeSummary.MAINTENANCE.outgoing += absVal;
        if (!feeTypeMopSummary.MAINTENANCE[mopKey]) {
          feeTypeMopSummary.MAINTENANCE[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.MAINTENANCE[mopKey].outgoing += absVal;
      }
    }

    if (j.misc !== 0) {
      if (j.misc > 0) {
        feeSummary.MISC.incoming += j.misc;
        if (!feeTypeMopSummary.MISC[mopKey]) {
          feeTypeMopSummary.MISC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.MISC[mopKey].incoming += j.misc;
      } else {
        const absVal = Math.abs(j.misc);
        feeSummary.MISC.outgoing += absVal;
        if (!feeTypeMopSummary.MISC[mopKey]) {
          feeTypeMopSummary.MISC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.MISC[mopKey].outgoing += absVal;
      }
    }
  });

  // Collection Summary
  const waterColl = {
    target: accounts.reduce((s, r) => s + r.waterBase, 0),
    waived: accounts.reduce((s, r) => s + r.waterWaived, 0),
    resident: processedJournal.reduce(
      (s, j) => s + (j.type === TransactionType.COLLECTION && j.water > 0 ? j.water : 0),
      0
    ),
    uho: processedJournal.reduce(
      (s, j) => s + (j.type === TransactionType.COLLECTION_OTHERS ? j.water : 0),
      0
    ),
    refunds: processedJournal.reduce(
      (s, j) => s + (j.type === TransactionType.COLLECTION && j.water < 0 ? Math.abs(j.water) : 0),
      0
    ),
    overdue: accounts.reduce((s, r) => s + (r.waterBal > 0 ? r.waterBal : 0), 0),
    aquaAltria: processedJournal.reduce(
      (s, j) =>
        s +
        (j.type === "WATER_AQUA_ALTRIA"
          ? Math.abs(j.water + j.assoc + (j.maintenance || 0) + j.misc)
          : 0),
      0
    ),
    paidToWater: processedJournal.reduce(
      (s, j) =>
        s +
        (j.type === "WATER"
          ? Math.abs(j.water + j.assoc + (j.maintenance || 0) + j.misc)
          : 0),
      0
    )
  };

  const assocColl = {
    target: accounts.reduce((s, r) => s + r.assocBase, 0),
    waived: accounts.reduce((s, r) => s + r.assocWaived, 0),
    resident: processedJournal.reduce(
      (s, j) => s + (j.type === TransactionType.COLLECTION && j.assoc > 0 ? j.assoc : 0),
      0
    ),
    refunds: processedJournal.reduce(
      (s, j) => s + (j.type === TransactionType.COLLECTION && j.assoc < 0 ? Math.abs(j.assoc) : 0),
      0
    ),
    overdue: accounts.reduce((s, r) => s + (r.assocBal > 0 ? r.assocBal : 0), 0)
  };

  const maintenanceColl = {
    target: accounts.reduce((s, r) => s + (r.maintenanceBase || 0), 0),
    waived: accounts.reduce((s, r) => s + (r.maintenanceWaived || 0), 0),
    resident: processedJournal.reduce(
      (s, j) =>
        s +
        (j.type === TransactionType.COLLECTION && (j.maintenance || 0) > 0
          ? j.maintenance || 0
          : 0),
      0
    ),
    refunds: processedJournal.reduce(
      (s, j) =>
        s +
        (j.type === TransactionType.COLLECTION && (j.maintenance || 0) < 0
          ? Math.abs(j.maintenance || 0)
          : 0),
      0
    ),
    overdue: accounts.reduce((s, r) => s + ((r.maintenanceBal || 0) > 0 ? r.maintenanceBal || 0 : 0), 0)
  };

  return {
    processedJournal,
    runningBalance,
    mopSummary,
    feeSummary,
    feeTypeMopSummary,
    waterColl,
    assocColl,
    maintenanceColl
  };
}

export async function exportFinancialReportPDF(options: FinancialReportOptions) {
  const {
    journal,
    accounts,
    semester,
    brandingKey,
    issuedBy,
    assessedBy,
    certifiedBy,
    periodCovered,
    availableMops
  } = options;

  const pdfMake = await getPdfMake();

  const profile = brandingState.profile;
  const letterheadData = await imgToDataUrl(
    (profile as any).letterheadHalfInchUrl || profile.letterheadUrl
  );

  const {
    processedJournal,
    runningBalance,
    mopSummary,
    feeSummary,
    feeTypeMopSummary,
    waterColl,
    assocColl,
    maintenanceColl
  } = computeFinancialReportData(journal, accounts, availableMops);

  const summaryLayout: CustomTableLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => "#000000",
    vLineColor: () => "#000000",
    paddingTop: () => 2,
    paddingBottom: () => 2,
    paddingLeft: () => 4,
    paddingRight: () => 4
  };

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [36, 40, 36, 60],
    background: function (currentPage: number): Content | null {
      if (currentPage === 1 && letterheadData) {
        return {
          image: letterheadData,
          width: 595.28
        };
      }
      return null;
    },
    content: [
      // PAGE 1: Summaries
      {
        text: "FINANCIAL REPORT",
        style: "mainHeader",
        margin: [0, 60, 0, 0]
      },
      {
        text: semester.toUpperCase(),
        fontSize: 12
      },

      { text: "ACCOUNT SUMMARY", style: "sectionHeader" },

      // Table 1: MOP Summary
      {
        table: {
          widths: ["*", 100, 100, 100],
          body: [
            [
              { text: "BY MODE OF PAYMENT¹", style: "tableHeader" },
              { text: "INCOMING", style: "tableHeader", alignment: "right" },
              { text: "OUTGOING", style: "tableHeader", alignment: "right" },
              { text: "BALANCE", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            ...Object.entries(mopSummary).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => m.value === mop);
              let label = mopConst ? mopConst.label : translateMop(mop);

              return [
                { text: label.toUpperCase(), fontSize: 9 },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "ENDING BALANCE", bold: true, fontSize: 9 },
              { text: "" },
              { text: "" },
              {
                text: formatAccounting(runningBalance),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[]
          ]
        },
        layout: summaryLayout,
        margin: [0, 0, 0, 15]
      },

      // Table 2: Fee Type Summary
      {
        table: {
          widths: ["*", 100, 100, 100],
          body: [
            [
              { text: "BY FEE TYPE¹", style: "tableHeader" },
              { text: "INCOMING", style: "tableHeader", alignment: "right" },
              { text: "OUTGOING", style: "tableHeader", alignment: "right" },
              { text: "BALANCE", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            [
              { text: "WATER FEE", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.WATER.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.WATER.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.WATER.incoming - feeSummary.WATER.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.WATER).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "ASSOCIATION FEE", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.ASSOC.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.ASSOC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.ASSOC.incoming - feeSummary.ASSOC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.ASSOC).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "MAINTENANCE & GAS FEE", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.MAINTENANCE.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.MAINTENANCE.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.MAINTENANCE.incoming - feeSummary.MAINTENANCE.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.MAINTENANCE).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "MISCELLANEOUS", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.MISC.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.MISC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.MISC.incoming - feeSummary.MISC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.MISC).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "ENDING BALANCE", bold: true, fontSize: 9 },
              { text: "" },
              { text: "" },
              {
                text: formatAccounting(runningBalance),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[]
          ]
        },
        layout: summaryLayout,
        margin: [0, 0, 0, 25]
      },

      { text: "COLLECTION SUMMARY", style: "sectionHeader" },

      // Table 3: Collection Summary
      {
        table: {
          widths: [80, "*", 100],
          body: [
            [
              { text: "CATEGORY", style: "tableHeader" },
              { text: "DETAILS", style: "tableHeader" },
              { text: "AMOUNT", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            // WATER FEE
            [
              {
                text: "WATER FEE",
                rowSpan: waterColl.aquaAltria > 0 ? 10 : 9,
                bold: true,
                alignment: "center",
                verticalAlignment: "middle",
                fontSize: 9
              } as any,
              { text: "TARGET", fontSize: 9 },
              { text: formatAccounting(waterColl.target), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "LESS: WAIVED", fontSize: 9 },
              { text: formatAccounting(waterColl.waived), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "TOTAL COLLECTION FROM RESIDENTS", fontSize: 9 },
              { text: formatAccounting(waterColl.resident), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "LESS: COLLECTION REFUNDS", fontSize: 9 },
              {
                text: formatAccounting(waterColl.resident - waterColl.refunds),
                alignment: "right",
                fontSize: 9
              }
            ] as TableCell[],
            [
              "",
              { text: "TOTAL COLLECTION FROM UHO", fontSize: 9 },
              { text: formatAccounting(waterColl.uho), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "TOTAL COLLECTION", bold: true, fontSize: 9 },
              {
                text: formatAccounting(waterColl.resident - waterColl.refunds + waterColl.uho),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            [
              "",
              { text: "OVERDUE ACCOUNTS²", bold: true, fontSize: 9 },
              {
                text: formatAccounting(waterColl.overdue),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...(waterColl.aquaAltria > 0
              ? [
                  [
                    "",
                    { text: `PAID TO WATER SUPPLIER (AQUA ALTRIA)³`, fontSize: 9 },
                    {
                      text: formatAccounting(waterColl.aquaAltria),
                      alignment: "right",
                      fontSize: 9
                    }
                  ] as TableCell[]
                ]
              : []),
            [
              "",
              { text: `PAID TO WATER SUPPLIER³`, fontSize: 9 },
              { text: formatAccounting(waterColl.paidToWater), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "PAID TO WATER SUPPLIER (TOTAL)³", bold: true, fontSize: 9 },
              {
                text: formatAccounting(waterColl.aquaAltria + waterColl.paidToWater),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            // ASSOC FEE
            ...(assocColl.target > 0
              ? [
                  [
                    {
                      text: "ASSOCIATION FEE",
                      rowSpan: 5,
                      bold: true,
                      alignment: "center",
                      verticalAlignment: "middle",
                      fontSize: 9
                    } as any,
                    { text: "TARGET", fontSize: 9 },
                    { text: formatAccounting(assocColl.target), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "LESS: WAIVED", fontSize: 9 },
                    { text: formatAccounting(assocColl.waived), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "TOTAL COLLECTION FROM RESIDENTS", fontSize: 9 },
                    { text: formatAccounting(assocColl.resident), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "LESS: COLLECTION REFUNDS", bold: true, fontSize: 9 },
                    {
                      text: formatAccounting(assocColl.resident - assocColl.refunds),
                      alignment: "right",
                      bold: true,
                      fontSize: 9
                    }
                  ] as TableCell[],
                  [
                    "",
                    { text: "OVERDUE ACCOUNTS²", bold: true, fontSize: 9 },
                    {
                      text: formatAccounting(assocColl.overdue),
                      alignment: "right",
                      bold: true,
                      fontSize: 9
                    }
                  ] as TableCell[]
                ]
              : []),
            // MAINTENANCE & GAS FEE
            ...(maintenanceColl.target > 0
              ? [
                  [
                    {
                      text: "MAINTENANCE & GAS FEE",
                      rowSpan: 5,
                      bold: true,
                      alignment: "center",
                      verticalAlignment: "middle",
                      fontSize: 9
                    } as any,
                    { text: "TARGET", fontSize: 9 },
                    { text: formatAccounting(maintenanceColl.target), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "LESS: WAIVED", fontSize: 9 },
                    { text: formatAccounting(maintenanceColl.waived), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "TOTAL COLLECTION FROM RESIDENTS", fontSize: 9 },
                    {
                      text: formatAccounting(maintenanceColl.resident),
                      alignment: "right",
                      fontSize: 9
                    }
                  ] as TableCell[],
                  [
                    "",
                    { text: "LESS: COLLECTION REFUNDS", bold: true, fontSize: 9 },
                    {
                      text: formatAccounting(maintenanceColl.resident - maintenanceColl.refunds),
                      alignment: "right",
                      bold: true,
                      fontSize: 9
                    }
                  ] as TableCell[],
                  [
                    "",
                    { text: "OVERDUE ACCOUNTS²", bold: true, fontSize: 9 },
                    {
                      text: formatAccounting(maintenanceColl.overdue),
                      alignment: "right",
                      bold: true,
                      fontSize: 9
                    }
                  ] as TableCell[]
                ]
              : [])
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000"
        },
        margin: [0, 0, 0, 20]
      },

      {
        text: "¹ Amounts may appear inflated due to internal transfers between accounts (e.g., Cash to GCash).",
        fontSize: 11,
        margin: [0, 0, 0, 2]
      },
      {
        text: "² Residents who have not settled their accounts by the due date and are considered to be in arrears.",
        fontSize: 11,
        margin: [0, 0, 0, 2]
      },
      {
        text: `³ Period covered: ${periodCovered} (excluding transaction fees).`,
        fontSize: 11,
        margin: [0, 0, 0, 15]
      },

      {
        columns: [
          {
            width: "auto",
            stack: [
              { text: "Financial Report issued by:", fontSize: 11 },
              { text: "Assessed by:", fontSize: 11 },
              { text: "Certified by:", fontSize: 11 },
              { text: "Period Covered:", fontSize: 11 },
              { text: "Date Generated:", fontSize: 11 }
            ]
          },
          {
            width: "*",
            margin: [10, 0, 0, 0],
            stack: [
              { text: issuedBy, fontSize: 11 },
              { text: assessedBy, fontSize: 11 },
              { text: certifiedBy, fontSize: 11 },
              { text: periodCovered, fontSize: 11 },
              {
                text: `${new Date().toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true
                })} (HAOne v${__APP_VERSION__}-${__COMMIT_SHA__})`,
                fontSize: 11
              }
            ]
          }
        ],
        pageBreak: "after"
      },

      // PAGE 2+: Transaction Details
      { text: "ACCOUNT STATEMENT AND TRANSACTION DETAILS", style: "sectionHeader" },
      // Table 4: Transaction Details
      {
        table: {
          headerRows: 1,
          widths: [55, 85, "*", 55, 55, 55],
          body: [
            [
              { text: "DATE", style: "tableHeader" },
              { text: "TYPE", style: "tableHeader" },
              { text: "PARTICULARS", style: "tableHeader" },
              { text: "INCOMING", style: "tableHeader", alignment: "right" },
              { text: "OUTGOING", style: "tableHeader", alignment: "right" },
              { text: "BALANCE", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            ...processedJournal.map(
              (j) =>
                [
                  { text: j.date, fontSize: 8 },
                  { text: j.type, fontSize: 8 },
                  { text: (j.notes || "").toUpperCase(), fontSize: 8 },
                  { text: formatAccounting(j.incoming), alignment: "right", fontSize: 8 },
                  { text: formatAccounting(j.outgoing), alignment: "right", fontSize: 8 },
                  { text: formatAccounting(j.runningBalance), alignment: "right", fontSize: 8 }
                ] as TableCell[]
            ),
            // Totals
            [
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] }
            ],
            [
              { text: "", border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              { text: "BALANCE THIS STATEMENT", fontSize: 8, border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              {
                text: formatAccounting(runningBalance),
                alignment: "right",
                fontSize: 8,
                border: [true, true, true, true]
              }
            ] as TableCell[],
            [
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] }
            ],
            [
              { text: "", border: [true, false, true, true] },
              { text: "", border: [true, false, true, true] },
              { text: "TOTAL DEBIT", fontSize: 8, border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              {
                text: formatAccounting(processedJournal.reduce((s, j) => s + j.outgoing, 0)),
                alignment: "right",
                fontSize: 8,
                border: [true, true, true, true]
              },
              { text: "", border: [true, false, true, true] }
            ] as TableCell[],
            [
              { text: "", border: [true, false, true, true] },
              { text: "", border: [true, false, true, true] },
              { text: "TOTAL CREDIT", fontSize: 8, border: [true, true, true, true] },
              {
                text: formatAccounting(processedJournal.reduce((s, j) => s + j.incoming, 0)),
                alignment: "right",
                fontSize: 8,
                border: [true, true, true, true]
              },
              { text: "", border: [true, true, true, true] },
              { text: "", border: [true, false, true, true] }
            ] as TableCell[]
          ]
        },
        layout: {
          hLineWidth: (i, node) => {
            // Top, below header, and bottom lines only
            if (i === 0 || i === 1 || i === node.table.body.length) return 0.5;
            return 0;
          },
          vLineWidth: () => 0.5,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 4,
          paddingRight: () => 4
        }
      },

      {
        text: "Remarks:",
        bold: true,
        fontSize: 10,
        margin: [0, 15, 0, 5]
      },
      {
        text: "AF – Association Fee, WF – Water Fee, MF – Miscellaneous Fund",
        fontSize: 9
      }
    ],
    footer: function (currentPage: number, pageCount: number): Content {
      const pageInfo = {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "right" as Alignment,
        fontSize: 9
      };

      if (currentPage === 1) {
        return {
          stack: [
            {
              text: "This document is electronically generated and does not require a signature.",
              alignment: "center" as Alignment,
              fontSize: 8,
              color: "#000",
              margin: [0, 0, 0, 5]
            },
            pageInfo
          ],
          margin: [36, 10, 36, 0]
        };
      }

      return {
        ...pageInfo,
        margin: [0, 10, 36, 0]
      };
    },
    styles: {
      mainHeader: {
        fontSize: 16,
        bold: true
      },
      sectionHeader: {
        fontSize: 11,
        bold: true,
        margin: [0, 10, 0, 5]
      },
      tableHeader: {
        bold: true,
        fontSize: 8.5
      }
    },
    defaultStyle: {
      font: "Archivo",
      fontSize: 10
    }
  };

  pdfMake.createPdf(docDefinition).download(`Financial_Report_${semester.replace(/ /g, "_")}.pdf`);
}
