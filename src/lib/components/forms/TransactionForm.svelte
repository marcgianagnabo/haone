<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { page } from "$app/state";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import { SYSTEM_IDS } from "$lib/constants";
  import { fetchJournalEntries } from "$api/controllers/journal-controller";
  import { fetchConstants } from "$api/controllers/constants-controller";
  import { translatePeriod, translateMop } from "$utils/translators";
  import { parseRef } from "$utils/parsers";
  import { formatAmount, formatAccounting } from "$utils/formatters";
  import { sortPeriods } from "$utils/sort";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { Combobox } from "$ui/combobox";
  import {
    LoaderCircle,
    Calendar,
    Users,
    Wallet,
    StickyNote,
    Eye,
    Save,
    ArrowLeftToLine,
    TriangleAlert
  } from "@lucide/svelte";
  import { Checkbox } from "$ui/checkbox";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { AccountCombobox } from "$components/ui/haone";
  import FinancialStandingCard from "$components/residents/FinancialStandingCard.svelte";
  import * as Dialog from "$ui/dialog";
  import * as Tooltip from "$ui/tooltip";
  import { Badge } from "$ui/badge";
  import { fetchResidents } from "$api/controllers/resident-controller";
  import {
    JOURNAL_COL as JOR,
    TransactionType,
    TRANSACTION_TYPE_OPTIONS,
    TRANSACTION_TYPE_FUNDS_ONLY,
    type ResidentRecord,
    type JournalRecord,
    TRANSACTION_TYPE_WITH_RECEIPT,
    TRANSACTION_TYPE_MAYBE_WITH_RECEIPT
  } from "$lib/types";
  import { globalDialog } from "$state/dialog.svelte";
  import { toast } from "svelte-sonner";

  interface Props {
    mode: "add" | "edit";
    initialData?: JournalRecord | null;
    isSubmitting: boolean;
    onSave: (row: any[]) => Promise<void>;
    hideHeader?: boolean;
    onStateChange?: (data: any) => void;
  }

  let {
    mode,
    initialData = null,
    isSubmitting,
    onSave,
    hideHeader = false,
    onStateChange
  }: Props = $props();

  let accounts = $state<ResidentRecord[]>([]);
  let academicTerms = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  const mopOptions = $derived(mopTypes);
  let isLoading = $state(true);
  let isReady = $state(false);
  let error = $state<string | null>(null);
  let selectedResident = $state<ResidentRecord | null>(null);
  let isStandingOpen = $state(false);
  let allowOverpayment = $state(false);
  let hasConfirmedTerm = $state(false);

  // Form State
  // FIXME: also using legacy fields.
  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    creatorName: auth.displayNameLastFirst || "",
    creatorStNo: "",
    creatorId: "",
    accountName: "",
    accountStNo: "",
    accountId: "",
    waterFee: "0",
    assocFee: "0",
    maintenanceFee: "0",
    miscFee: "0",
    mop: "CASH",
    mopTo: "CASH",
    period: settings.currentTerm || "",
    type: TransactionType.COLLECTION,
    notes: "",
    notesPrivate: "",
    mopRefNo: "",
    instapayInvoice: "",
    receiptUrl: "",
    prDateIssued: "",
    prRefNo: ""
  });

  let carryoverTerm = $state("");
  const isEos = $derived(
    formData.type === TransactionType.EOS || formData.type === TransactionType.EOS_UNSETTLED
  );

  const typeOptions = $derived([
    ...TRANSACTION_TYPE_OPTIONS.filter((t) => {
      if (t.value === formData.type) {
        return true;
      }
      return (
        t.value !== TransactionType.CARRYOVER &&
        t.value !== TransactionType.TRANSFER_FROM &&
        t.value !== TransactionType.TRANSFER_TO
      );
    })
  ]);

  const isTypeDisabled = $derived(
    isSubmitting ||
      formData.type === TransactionType.TRANSFER_FROM ||
      formData.type === TransactionType.TRANSFER_TO ||
      formData.type === TransactionType.CARRYOVER
  );

  const carryoverAcademicTerms = $derived.by(() => {
    if (!formData.period) {
      return [];
    }
    const getWeight = (p: string) => {
      const match = p.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);
      if (!match) {
        return 0;
      }
      const year = parseInt(match[1]);
      const term = match[3];
      const termWeight = term === "MY" ? 3 : term === "2S" ? 2 : term === "1S" ? 1 : 0;
      return year * 10 + termWeight;
    };
    const currentWeight = getWeight(formData.period);
    return academicTerms.filter((t) => {
      return getWeight(t.value) > currentWeight;
    });
  });

  $effect(() => {
    if (isEos && formData.mop) {
      fetchJournalEntries().then((entries) => {
        const currentTerm = formData.period || settings.currentTerm;
        const journal = Array.isArray(entries) ? entries : entries.items;

        // 1. Filter out j.type === "EOS" to match financial report page filtering
        const termJournal = journal.filter((j) => {
          return j.period === currentTerm && j.type !== "EOS" && j.type !== "EOS_UNSETTLED";
        });

        // 2. Data Processing (exact map from financial-report-pdf.ts)
        const processedJournal = termJournal.map((j) => {
          const isWaived = j.type.toUpperCase().includes("WAIVED");
          const amount = j.water + j.assoc + j.misc + (j.maintenance || 0);
          const incoming = !isWaived && amount > 0 ? amount : 0;
          const outgoing = !isWaived && amount < 0 ? Math.abs(amount) : 0;
          return {
            ...j,
            isWaived,
            incoming,
            outgoing
          };
        });

        // 3. Filter by MOP (exact match from financial-report-pdf.ts)
        const targetMop = formData.mop.trim().toUpperCase();
        const filtered = processedJournal.filter((j) => {
          const rawMop = (j.mop || "").trim().toUpperCase();
          if (rawMop === "N/A") {
            return false;
          }
          const key = rawMop || "CASH";
          return key === targetMop;
        });

        // 4. Compute water, assoc, misc sums (exclude waived and N/A)
        const nonWaivedFiltered = filtered.filter((j) => {
          return !j.isWaived;
        });

        const waterSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + j.water;
        }, 0);
        const assocSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + j.assoc;
        }, 0);
        const maintenanceSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + (j.maintenance || 0);
        }, 0);
        const miscSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + j.misc;
        }, 0);

        const waterBal = Math.round(waterSum * 100) / 100;
        const assocBal = Math.round(assocSum * 100) / 100;
        const maintenanceBal = Math.round(maintenanceSum * 100) / 100;
        const miscBal = Math.round(miscSum * 100) / 100;

        // Populate fields with negated balances
        formData.waterFee = (-waterBal).toString();
        formData.assocFee = (-assocBal).toString();
        formData.maintenanceFee = (-maintenanceBal).toString();
        formData.miscFee = (-miscBal).toString();
      });
    }
  });

  const isCollection = $derived.by(() => {
    const type = formData.type;
    return (
      type === TransactionType.COLLECTION ||
      type === TransactionType.REFUND_COLLECTION ||
      type === TransactionType.WAIVED
    );
  });

  const waterLimit = $derived.by(() => {
    if (!isCollection || !selectedResident) return 0;
    const base = selectedResident.waterBal;
    const original = mode === "edit" && initialData ? initialData.water : 0;
    return base + original;
  });

  const assocLimit = $derived.by(() => {
    if (!isCollection || !selectedResident) return 0;
    const base = selectedResident.assocBal;
    const original = mode === "edit" && initialData ? initialData.assoc : 0;
    return base + original;
  });

  const maintenanceLimit = $derived.by(() => {
    if (!isCollection || !selectedResident) return 0;
    const base = selectedResident.maintenanceBal || 0;
    const original = mode === "edit" && initialData ? initialData.maintenance || 0 : 0;
    return base + original;
  });

  const currentWaterBal = $derived.by(() => {
    if (!isCollection || !selectedResident) return selectedResident?.waterBal || 0;
    const fee = Number(formData.waterFee) || 0;
    return waterLimit - fee;
  });

  const currentAssocBal = $derived.by(() => {
    if (!isCollection || !selectedResident) return selectedResident?.assocBal || 0;
    const fee = Number(formData.assocFee) || 0;
    return assocLimit - fee;
  });

  const currentMaintenanceBal = $derived.by(() => {
    if (!isCollection || !selectedResident) return selectedResident?.maintenanceBal || 0;
    const fee = Number(formData.maintenanceFee) || 0;
    return maintenanceLimit - fee;
  });

  const isFundsOnly = $derived(
    TRANSACTION_TYPE_FUNDS_ONLY.includes(formData.type as TransactionType)
  );

  $effect(() => {
    if (!isReady) return;
    const snapshot = $state.snapshot(formData);
    untrack(() => {
      onStateChange?.(snapshot);
    });
  });

  $effect(() => {
    if (isFundsOnly && formData.accountId !== SYSTEM_IDS.FUNDS) {
      formData.accountName = (brandingState.profile.issuerName || "").toUpperCase();
      formData.accountId = SYSTEM_IDS.FUNDS;
      accountSearch = (brandingState.profile.issuerName || "").toUpperCase();
      selectedResident = accounts.find((a) => a.email === "_funds") || null;
    }
  });

  $effect(() => {
    formData.period;
    hasConfirmedTerm = false;
  });

  // Autocomplete State
  let creatorSearch = $state("");
  let accountSearch = $state("");

  async function loadData() {
    isLoading = true;
    try {
      const [allResidents, constants] = await Promise.all([fetchResidents(), fetchConstants()]);

      const rawAccounts = allResidents;

      const fundsAccount: ResidentRecord = {
        email: "_funds",
        name: (brandingState.profile.issuerName || "").toUpperCase(),
        stno: "SYSTEM",
        period: "ALWAYS",
        room: "",
        bed: "",
        waterBase: 0,
        waterPaid: 0,
        waterWaived: 0,
        waterBal: 0,
        assocBase: 0,
        assocPaid: 0,
        assocWaived: 0,
        assocBal: 0,
        totalBase: 0,
        paid: 0,
        waived: 0,
        bal: 0,
        isFullyPaid: true,
        notes: "",
        college: "",
        program: "",
        ceIssued: "",
        ceRefNo: "",
        ceLink: "",
        ceFullName: "",
        id: SYSTEM_IDS.FUNDS,
        residentId: SYSTEM_IDS.FUNDS,
        ledgerId: SYSTEM_IDS.FUNDS,
        checkInDate: "",
        type: "FUNDS" as any,
        raw: []
      };

      accounts = Array.from(
        new Map([...rawAccounts, fundsAccount].map((a) => [a.email, a])).values()
      );

      const termValues = constants
        .filter(
          (r) => r.key.startsWith("TERM_") && r.key !== "TERM_CURR" && r.key !== "TERM_RESERVED"
        )
        .map((r) => r.value || r.key);

      academicTerms = sortPeriods(termValues).map((val) => ({
        value: val,
        label: translatePeriod(val)
      }));

      mopTypes = [
        { value: "", label: "N/A" },
        ...constants
          .filter((r) => r.key.startsWith("MOP_"))
          .map((r) => ({
            value: r.value || r.key,
            label: translateMop(r.value || r.key)
          }))
      ];

      if (initialData) {
        const mopRefInfo = parseRef(initialData.mopRefNo);
        formData = {
          date: initialData.date,
          creatorName: initialData.creatorName,
          creatorStNo: "", // Resolving below
          creatorId: initialData.creatorId || "",
          accountName: initialData.name,
          accountStNo: initialData.stno,
          accountId: initialData.accountId || "",
          waterFee: initialData.water.toString(),
          assocFee: initialData.assoc.toString(),
          maintenanceFee: (initialData.maintenance || 0).toString(),
          miscFee: initialData.misc.toString(),
          mop: initialData.mop,
          mopTo: (initialData as any).mopTo || "CASH",
          period: initialData.period,
          type:
            (TRANSACTION_TYPE_OPTIONS.find((t) => t.value === initialData!.type)
              ?.value as TransactionType) || initialData.type,
          notes: initialData.notes,
          notesPrivate: initialData.notesPrivate,
          mopRefNo: mopRefInfo.reference || initialData.mopRefNo,
          instapayInvoice: mopRefInfo.invoice || "",
          receiptUrl: initialData.receiptUrl || "",
          prDateIssued: initialData.prDateIssued,
          prRefNo: initialData.prRefNo
        };
        creatorSearch = initialData.creatorName || initialData.creator;
        accountSearch = initialData.name || initialData.account;
        selectedResident =
          accounts.find(
            (a) =>
              (initialData!.accountId &&
                (a.residentId === initialData!.accountId || a.id === initialData!.accountId)) ||
              a.email.toLowerCase() === initialData!.account.toLowerCase() ||
              a.residentId === initialData!.account
          ) || null;

        if (selectedResident) {
          const limitW = selectedResident.waterBal + (mode === "edit" ? initialData.water : 0);
          const limitA = selectedResident.assocBal + (mode === "edit" ? initialData.assoc : 0);
          const limitM = (selectedResident.maintenanceBal || 0) +
            (mode === "edit" ? initialData.maintenance || 0 : 0);
          if (
            initialData.water > limitW + 0.01 ||
            initialData.assoc > limitA + 0.01 ||
            (initialData.maintenance || 0) > limitM + 0.01
          ) {
            allowOverpayment = true;
          }
          if (!formData.accountId) {
            formData.accountId = selectedResident.residentId || selectedResident.id;
          }
        }

        // Resolve creator student number and id
        const creatorAcc = accounts.find(
          (a) =>
            initialData!.creatorId &&
            (a.residentId === initialData!.creatorId || a.id === initialData!.creatorId)
        );
        if (creatorAcc) {
          formData.creatorStNo = creatorAcc.stno;
          if (!formData.creatorId) {
            formData.creatorId = creatorAcc.residentId || creatorAcc.id;
          }
          if (!formData.creatorName) {
            formData.creatorName = creatorAcc.name;
          }
        }
      } else if (auth.user) {
        formData.creatorStNo = auth.user.studentNo;
        formData.creatorName = auth.displayNameLastFirst;
        formData.creatorId = auth.userId;
        creatorSearch = auth.displayNameLastFirst;
      }

      // Pre-fill target account from query parameters if provided
      const targetAccountParam = page.url.searchParams.get("account");
      if (targetAccountParam) {
        const targetAcc = accounts.find(
          (a) =>
            (a.residentId && a.residentId.toLowerCase() === targetAccountParam.toLowerCase()) ||
            (a.stno && a.stno.toLowerCase() === targetAccountParam.toLowerCase()) ||
            (a.email && a.email.toLowerCase() === targetAccountParam.toLowerCase())
        );
        if (targetAcc) {
          selectAccount(targetAcc);
        }
      }
      isReady = true;
    } catch (e: any) {
      error = `Failed to load data: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  function selectCreator(a: ResidentRecord) {
    formData.creatorName = a.name;
    formData.creatorStNo = a.stno;
    formData.creatorId = a.residentId;
    creatorSearch = a.name;
  }

  function selectAccount(a: ResidentRecord) {
    formData.accountName = a.name;
    formData.accountStNo = a.stno;
    formData.accountId = a.residentId;
    accountSearch = a.name;
    selectedResident = a;
  }

  function confirmSubmitForInactiveTerm() {
    globalDialog.confirm(
      "Record transaction for inactive term?",
      `This transaction will be recorded under ${translatePeriod(formData.period)} instead of the active term (${translatePeriod(settings.activeTerm)}).`,
      undefined,
      async () => {
        try {
          hasConfirmedTerm = true;
          await handleSubmit();
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Record transaction",
        cancel: "Cancel"
      }
    );
  }

  async function handleSubmit() {
    if (!formData.creatorId || !formData.accountId) {
      error = "Please select both a Recorder and an Account.";
      return;
    }

    if (formData.type === TransactionType.FUND_TRANSFER && formData.mop === formData.mopTo) {
      error = "Source (From) and destination (To) payment processors cannot be the same.";
      return;
    }

    const water = parseFloat(formData.waterFee) || 0;
    const assoc = parseFloat(formData.assocFee) || 0;
    const maintenance = parseFloat(formData.maintenanceFee) || 0;
    const misc = parseFloat(formData.miscFee) || 0;

    if (water === 0 && assoc === 0 && maintenance === 0 && misc === 0) {
      error = "Transaction must have at least one non-zero amount.";
      return;
    }

    const isTransfer =
      formData.type === TransactionType.FUND_TRANSFER ||
      formData.type === TransactionType.TRANSFER_FROM ||
      formData.type === TransactionType.TRANSFER_TO;

    if (!isTransfer && misc > 0 && !formData.notes.trim()) {
      error = "Public remarks are required for miscellaneous payments.";
      return;
    }

    if (isCollection && !allowOverpayment) {
      if (water > waterLimit + 0.01) {
        error = `Water payment exceeds remaining balance limit (${formatAmount(waterLimit)}).`;
        return;
      }
      if (assoc > assocLimit + 0.01) {
        error = `Association payment exceeds remaining balance limit (${formatAmount(assocLimit)}).`;
        return;
      }
      if (maintenance > maintenanceLimit + 0.01) {
        error = `Maintenance payment exceeds remaining balance limit (${formatAmount(maintenanceLimit)}).`;
        return;
      }
    }

    if (formData.period !== settings.currentTerm && !hasConfirmedTerm) {
      confirmSubmitForInactiveTerm();
      return;
    }

    error = null;

    try {
      if (formData.type === TransactionType.FUND_TRANSFER) {
        // From Row: Negative amount, MOP From
        const fromRow = new Array(24).fill("");
        fromRow[JOR.DATE] = formData.date;
        fromRow[JOR.CREATOR] = "";
        fromRow[JOR.ACCOUNT] = "";
        fromRow[JOR.WATER] = water !== 0 ? `-${Math.abs(water)}` : "0";
        fromRow[JOR.ASSOC] = assoc !== 0 ? `-${Math.abs(assoc)}` : "0";
        fromRow[JOR.MAINTENANCE] = maintenance !== 0 ? `-${Math.abs(maintenance)}` : "0";
        fromRow[JOR.MISC] = misc !== 0 ? `-${Math.abs(misc)}` : "0";
        fromRow[JOR.MOP] = formData.mop;
        fromRow[JOR.PERIOD] = formData.period;
        fromRow[JOR.TYPE] = TransactionType.TRANSFER_FROM;
        fromRow[JOR.NOTES] = formData.notes;
        fromRow[JOR.NOTES_PRIVATE] = formData.notesPrivate;
        fromRow[JOR.MOP_REFNO] = formData.instapayInvoice
          ? `${formData.mopRefNo};${formData.instapayInvoice}`
          : formData.mopRefNo;
        fromRow[JOR.PR_DATE_ISSUED] = formData.prDateIssued;
        fromRow[JOR.PR_REFNO] = "N/A";
        fromRow[JOR.CREATOR_NAME] = "";
        fromRow[JOR.NAME] = "";
        fromRow[JOR.STNO] = "";
        fromRow[JOR.RECEIPT_URL] = formData.receiptUrl || "";
        fromRow[JOR.WAS_AUDITED] = mode === "edit" && initialData?.wasAudited ? "TRUE" : "FALSE";
        fromRow[JOR.ID] = mode === "edit" && initialData ? initialData.id : crypto.randomUUID();
        fromRow[JOR.CREATOR_ID] = formData.creatorId || "";
        fromRow[JOR.ACCOUNT_ID] = formData.accountId || "";

        // To Row: Positive amount, MOP To
        const toRow = new Array(24).fill("");
        toRow[JOR.DATE] = formData.date;
        toRow[JOR.CREATOR] = "";
        toRow[JOR.ACCOUNT] = "";
        toRow[JOR.WATER] = water !== 0 ? `${Math.abs(water)}` : "0";
        toRow[JOR.ASSOC] = assoc !== 0 ? `${Math.abs(assoc)}` : "0";
        toRow[JOR.MAINTENANCE] = maintenance !== 0 ? `${Math.abs(maintenance)}` : "0";
        toRow[JOR.MISC] = misc !== 0 ? `${Math.abs(misc)}` : "0";
        toRow[JOR.MOP] = formData.mopTo;
        toRow[JOR.PERIOD] = formData.period;
        toRow[JOR.TYPE] = TransactionType.TRANSFER_TO;
        toRow[JOR.NOTES] = formData.notes;
        toRow[JOR.NOTES_PRIVATE] = formData.notesPrivate;
        toRow[JOR.MOP_REFNO] = formData.instapayInvoice
          ? `${formData.mopRefNo};${formData.instapayInvoice}`
          : formData.mopRefNo;
        toRow[JOR.PR_DATE_ISSUED] = formData.prDateIssued;
        toRow[JOR.PR_REFNO] = "N/A";
        toRow[JOR.CREATOR_NAME] = "";
        toRow[JOR.NAME] = "";
        toRow[JOR.STNO] = "";
        toRow[JOR.RECEIPT_URL] = formData.receiptUrl || "";
        toRow[JOR.WAS_AUDITED] = "FALSE";
        toRow[JOR.ID] = crypto.randomUUID();
        toRow[JOR.CREATOR_ID] = formData.creatorId || "";
        toRow[JOR.ACCOUNT_ID] = formData.accountId || "";

        await onSave([fromRow, toRow]);
        return;
      }

      const row = new Array(24).fill("");
      row[JOR.DATE] = formData.date;
      row[JOR.CREATOR] = "";
      row[JOR.ACCOUNT] = "";
      const negativeTypes: string[] = [
        TransactionType.REFUND,
        TransactionType.REFUND_COLLECTION,
        TransactionType.PURCHASE,
        TransactionType.WATER,
        TransactionType.WATER_AA,
        TransactionType.TRANSACTION_FEE,
        TransactionType.UPLB_ADA_FEE,
        TransactionType.TRANSPORTATION
      ];
      const isNegative = negativeTypes.includes(formData.type);

      row[JOR.WATER] =
        isNegative && parseFloat(formData.waterFee) !== 0
          ? `-${Math.abs(parseFloat(formData.waterFee))}`
          : formData.waterFee || "0";
      row[JOR.ASSOC] =
        isNegative && parseFloat(formData.assocFee) !== 0
          ? `-${Math.abs(parseFloat(formData.assocFee))}`
          : formData.assocFee || "0";
      row[JOR.MAINTENANCE] =
        isNegative && parseFloat(formData.maintenanceFee) !== 0
          ? `-${Math.abs(parseFloat(formData.maintenanceFee))}`
          : formData.maintenanceFee || "0";
      row[JOR.MISC] =
        formData.type === TransactionType.WAIVED
          ? "0"
          : isNegative && parseFloat(formData.miscFee) !== 0
            ? `-${Math.abs(parseFloat(formData.miscFee))}`
            : formData.miscFee || "0";
      row[JOR.MOP] =
        formData.type === TransactionType.WAIVED || formData.type === TransactionType.DISCREPANCY
          ? ""
          : formData.mop;
      row[JOR.PERIOD] = formData.period;
      const mappedType: TransactionType =
        (TRANSACTION_TYPE_OPTIONS.find((t) => t.value === formData.type)
          ?.value as TransactionType) || formData.type;
      row[JOR.TYPE] = mappedType;
      row[JOR.NOTES] = formData.notes;
      row[JOR.NOTES_PRIVATE] = formData.notesPrivate;
      row[JOR.MOP_REFNO] =
        formData.type === TransactionType.WAIVED || formData.type === TransactionType.DISCREPANCY
          ? ""
          : formData.instapayInvoice
            ? `${formData.mopRefNo};${formData.instapayInvoice}`
            : formData.mopRefNo;
      row[JOR.PR_DATE_ISSUED] = formData.prDateIssued;

      // PR_REFNO logic based on TYPE and Account

      let prRef = formData.prRefNo;
      const isFunds = formData.accountId === SYSTEM_IDS.FUNDS;
      const isRefund =
        mappedType === TransactionType.REFUND || mappedType === TransactionType.REFUND_COLLECTION;

      const needsPr =
        TRANSACTION_TYPE_WITH_RECEIPT.includes(mappedType) ||
        ((TRANSACTION_TYPE_MAYBE_WITH_RECEIPT.includes(mappedType) || isRefund) && !isFunds);

      if (!needsPr) {
        prRef = "N/A";
      }

      row[JOR.PR_REFNO] = prRef || "";
      row[JOR.CREATOR_NAME] = "";
      row[JOR.NAME] = "";
      row[JOR.STNO] = "";
      row[JOR.RECEIPT_URL] = formData.receiptUrl || "";

      if (mode === "edit") {
        row[JOR.WAS_AUDITED] = initialData?.wasAudited ? "TRUE" : "FALSE";
        row[JOR.ID] = initialData?.id;
      } else {
        row[JOR.WAS_AUDITED] = "FALSE";
        row[JOR.ID] = crypto.randomUUID();
      }
      row[JOR.CREATOR_ID] = formData.creatorId || "";
      row[JOR.ACCOUNT_ID] = formData.accountId || "";

      if (mode === "add" && isEos && carryoverTerm) {
        const carryoverRow = new Array(24).fill("");
        carryoverRow[JOR.DATE] = formData.date;
        carryoverRow[JOR.CREATOR] = "";
        carryoverRow[JOR.ACCOUNT] = "";
        carryoverRow[JOR.WATER] = water !== 0 ? (-water).toString() : "0";
        carryoverRow[JOR.ASSOC] = assoc !== 0 ? (-assoc).toString() : "0";
        carryoverRow[JOR.MAINTENANCE] = maintenance !== 0 ? (-maintenance).toString() : "0";
        carryoverRow[JOR.MISC] = misc !== 0 ? (-misc).toString() : "0";
        carryoverRow[JOR.MOP] = formData.mop;
        carryoverRow[JOR.PERIOD] = carryoverTerm;
        const mappedCarryoverType =
          TRANSACTION_TYPE_OPTIONS.find((t) => {
            return t.value === TransactionType.CARRYOVER;
          })?.value || TransactionType.CARRYOVER;
        carryoverRow[JOR.TYPE] = mappedCarryoverType;
        carryoverRow[JOR.NOTES] = "";
        carryoverRow[JOR.NOTES_PRIVATE] = "";
        carryoverRow[JOR.MOP_REFNO] = row[JOR.MOP_REFNO];
        carryoverRow[JOR.PR_DATE_ISSUED] = "";
        carryoverRow[JOR.PR_REFNO] = "N/A";
        carryoverRow[JOR.CREATOR_NAME] = "";
        carryoverRow[JOR.NAME] = "";
        carryoverRow[JOR.STNO] = "";
        carryoverRow[JOR.RECEIPT_URL] = "";
        carryoverRow[JOR.WAS_AUDITED] = "FALSE";
        carryoverRow[JOR.ID] = crypto.randomUUID();
        carryoverRow[JOR.CREATOR_ID] = formData.creatorId || "";
        carryoverRow[JOR.ACCOUNT_ID] = formData.accountId || "";

        await onSave([row, carryoverRow]);
      } else {
        await onSave(row);
      }
    } catch (e: any) {
      error = `Submission failed: ${e.message}`;
    }
  }
</script>

<!-- FIXME: Subpage header should not be handled by this component -->
<div class="mx-auto max-w-7xl space-y-3">
  {#if !hideHeader}
    <ContentHeader title={mode === "add" ? "Add Transaction" : "Edit Transaction"} />
  {/if}

  <div class="mx-auto max-w-3xl space-y-6">
    {#if error}
      <ErrorView {error} class="mb-4">
        {#if accounts.length === 0}
          <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}
            >Try Again</Button
          >
        {/if}
      </ErrorView>
    {/if}

    {#if isLoading}
      <div class="flex h-64 items-center justify-center">
        <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    {:else}
      <Card.Root>
        <Card.Content class="space-y-8">
          <!-- Basic Details -->
          <div class="space-y-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Calendar class="h-3.5 w-3.5" /> General Information
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Transaction Date</Label>
                <Input type="date" bind:value={formData.date} />
              </div>
              <div class="space-y-2">
                <Label>Academic Term</Label>
                <Combobox bind:value={formData.period} options={academicTerms} class="w-full" />
                {#if formData.period !== settings.currentTerm}
                  <div
                    class="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs font-bold text-amber-600 uppercase dark:bg-amber-500/20 dark:text-amber-500"
                  >
                    <TriangleAlert class="h-3 w-3" />
                    Caution: Inactive term
                  </div>
                {/if}
              </div>
            </div>
            <div class="space-y-2">
              <Label>Type</Label>
              <Combobox
                bind:value={formData.type}
                options={typeOptions}
                disabled={isTypeDisabled}
                class="w-full"
              />
              {#if isTypeDisabled && !isSubmitting}
                <p class="mt-1 text-xs text-muted-foreground">
                  This is a special transaction type and cannot be changed.
                </p>
              {/if}
            </div>

            {#if isEos && mode === "add"}
              <div class="animate-in space-y-2 duration-200 fade-in">
                <Label>Carryover Academic Term</Label>
                <Combobox
                  bind:value={carryoverTerm}
                  options={carryoverAcademicTerms}
                  placeholder="Select term to carry over entries to…"
                  class="w-full"
                />
              </div>
            {/if}
          </div>

          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Users class="h-3.5 w-3.5" /> Transaction Parties
            </Label>
            <div class="grid gap-8 md:grid-cols-2">
              <div class="relative space-y-3">
                <AccountCombobox
                  label="Recorder"
                  placeholder="Search resident email or name…"
                  {accounts}
                  filter={(a) => !formData.period || a.period === formData.period}
                  onSelect={selectCreator}
                  bind:value={creatorSearch}
                />
                <div
                  class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
                >
                  <div class="flex flex-col">
                    <span
                      class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                      >Current Selection</span
                    >
                    <span class="text-xs font-bold text-foreground/80"
                      >{formData.creatorName || "None selected"}</span
                    >
                    {#if formData.creatorStNo}
                      <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                        >{formData.creatorStNo}</span
                      >
                    {/if}
                  </div>
                </div>
              </div>

              {#if !isFundsOnly}
                <div class="relative space-y-3">
                  <AccountCombobox
                    label="Account"
                    placeholder="Search resident email or name…"
                    {accounts}
                    filter={(a) =>
                      a.email === "_funds" || !formData.period || a.period === formData.period}
                    onSelect={selectAccount}
                    bind:value={accountSearch}
                  />
                  <div
                    class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
                  >
                    <div class="flex flex-col">
                      <span
                        class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                        >Current Selection</span
                      >
                      <span class="text-xs font-bold text-foreground/80"
                        >{formData.accountName || "None selected"}</span
                      >
                      {#if formData.accountStNo}
                        <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                          >{formData.accountStNo}</span
                        >
                      {/if}
                    </div>

                    {#if formData.type === TransactionType.COLLECTION && selectedResident && selectedResident.email !== "_funds"}
                      <Dialog.Root bind:open={isStandingOpen}>
                        <Dialog.Trigger>
                          {#snippet child({ props })}
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-8 w-8 text-muted-foreground transition-colors hover:text-primary"
                              {...props}
                              title="View Financial Standing"
                            >
                              <Eye class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Dialog.Trigger>
                        <Dialog.Content class="sm:max-w-106.25">
                          <Dialog.Header>
                            <Dialog.Title>Financial Standing</Dialog.Title>
                            <Dialog.Description>
                              Current account balances for {selectedResident.name}.
                            </Dialog.Description>
                          </Dialog.Header>
                          <FinancialStandingCard account={selectedResident} hideCard={true} />
                        </Dialog.Content>
                      </Dialog.Root>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Payment Details -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Wallet class="h-3.5 w-3.5" /> Payment Details
            </Label>
            <div class="space-y-4">
              <!-- Water Fee Row -->
              <div class="grid gap-4 {isCollection && selectedResident ? 'md:grid-cols-2' : ''}">
                <div class="space-y-1.5">
                  <Label>Water Fee</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.waterFee}
                      max={isCollection && !allowOverpayment ? waterLimit : undefined}
                      disabled={!formData.accountId || isSubmitting || isEos}
                      class="text-right font-mono"
                    />
                    {#if isCollection && selectedResident}
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
                            >
                              <ArrowLeftToLine class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p class="text-xs font-bold">Set to Maximum</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  </div>
                </div>
                {#if isCollection && selectedResident}
                  <div class="space-y-1.5">
                    <Label>Remaining Water Balance</Label>
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
                {/if}
              </div>

              <!-- Association Fee Row -->
              <div class="grid gap-4 {isCollection && selectedResident ? 'md:grid-cols-2' : ''}">
                <div class="space-y-1.5">
                  <Label>Association Fee</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.assocFee}
                      max={isCollection && !allowOverpayment ? assocLimit : undefined}
                      disabled={!formData.accountId || isSubmitting || isEos}
                      class="text-right font-mono"
                    />
                    {#if isCollection && selectedResident}
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
                            >
                              <ArrowLeftToLine class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p class="text-xs font-bold">Set to Maximum</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  </div>
                </div>
                {#if isCollection && selectedResident}
                  <div class="space-y-1.5">
                    <Label>Remaining Association Balance</Label>
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
                {/if}
              </div>

              <!-- Maintenance Fee Row -->
              <div class="grid gap-4 {isCollection && selectedResident ? 'md:grid-cols-2' : ''}">
                <div class="space-y-1.5">
                  <Label>Maintenance & Gas Fee</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.maintenanceFee}
                      max={isCollection && !allowOverpayment ? maintenanceLimit : undefined}
                      disabled={!formData.accountId || isSubmitting || isEos}
                      class="text-right font-mono"
                    />
                    {#if isCollection && selectedResident}
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
                            >
                              <ArrowLeftToLine class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p class="text-xs font-bold">Set to Maximum</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  </div>
                </div>
                {#if isCollection && selectedResident}
                  <div class="space-y-1.5">
                    <Label>Remaining Maintenance & Gas Balance</Label>
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
                {/if}
              </div>

              {#if formData.type !== TransactionType.WAIVED}
                <!-- Misc Fee Row -->
                <div class="space-y-1.5">
                  <Label>Misc</Label>
                  <Input
                    type="number"
                    step="0.01"
                    bind:value={formData.miscFee}
                    disabled={!formData.accountId || isSubmitting || isEos}
                    class="text-right font-mono"
                  />
                </div>
              {/if}

              {#if isCollection && selectedResident && selectedResident.email !== "_funds"}
                <div
                  class="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <Checkbox id="allowOverpayment" bind:checked={allowOverpayment} />
                  <div class="grid gap-0.5">
                    <Label for="allowOverpayment" class="cursor-pointer">Allow Overpayment</Label>
                    <p class="text-xs leading-tight text-muted-foreground">
                      Override balance validation for water, association, and maintenance fees.
                    </p>
                  </div>
                </div>
              {/if}
            </div>

            {#if formData.type !== TransactionType.WAIVED && formData.type !== TransactionType.DISCREPANCY}
              <div
                class="grid gap-6 pt-2 {formData.type === TransactionType.FUND_TRANSFER
                  ? 'md:grid-cols-2'
                  : ''}"
              >
                <div class="space-y-1.5">
                  <Label
                    >{formData.type === TransactionType.FUND_TRANSFER
                      ? "Payment Processor (From)"
                      : "Payment Processor"}</Label
                  >
                  <Combobox
                    bind:value={formData.mop}
                    options={mopOptions}
                    disabled={!formData.accountId || isSubmitting}
                    class="w-full"
                  />
                </div>
                {#if formData.type === TransactionType.FUND_TRANSFER}
                  <div class="space-y-1.5">
                    <Label>Payment Processor (To)</Label>
                    <Combobox
                      bind:value={formData.mopTo}
                      options={mopOptions}
                      disabled={!formData.accountId || isSubmitting}
                      class="w-full"
                    />
                  </div>
                {/if}
              </div>
            {/if}

            {#if formData.type !== TransactionType.WAIVED && formData.type !== TransactionType.DISCREPANCY}
              <div class="grid gap-6 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label>Reference Number</Label>
                  <Input
                    bind:value={formData.mopRefNo}
                    disabled={!formData.accountId || isSubmitting}
                    placeholder="e.g., Transaction ID"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label>InstaPay Invoice Number</Label>
                  <Input
                    bind:value={formData.instapayInvoice}
                    disabled={!formData.accountId || isSubmitting}
                    placeholder="Optional"
                  />
                </div>
              </div>
            {/if}
          </div>

          <!-- Notes -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <StickyNote class="h-3.5 w-3.5" /> Documentation
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Public Remarks</Label>
                <Textarea
                  bind:value={formData.notes}
                  placeholder="Description for the resident…"
                  class="h-30 text-xs"
                />
              </div>
              <div class="space-y-2">
                <Label>Private Notes</Label>
                <Textarea
                  bind:value={formData.notesPrivate}
                  placeholder="Internal context only (not visible to resident)…"
                  class="h-30 text-xs"
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t pt-4">
            <Button
              onclick={handleSubmit}
              disabled={!formData.accountId || !formData.creatorId}
              isLoading={isSubmitting}
              icon={Save}
              class="min-w-30"
            >
              Save
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
