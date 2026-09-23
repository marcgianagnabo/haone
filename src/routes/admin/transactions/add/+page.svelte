<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import { goto } from "$app/navigation";
  import { settings } from "$state/settings.svelte";
  import { addJournalEntries } from "$api/controllers/journal-controller";
  import TransactionForm from "$components/forms/TransactionForm.svelte";

  let isSubmitting = $state(false);

  async function handleSave(row: any[] | any[][]) {
    isSubmitting = true;
    try {
      const rows = Array.isArray(row[0]) ? (row as any[][]) : [row as any[]];
      const entries = rows.map((r) => ({
        date: r[0],
        creator: "",
        account: "",
        water: parseFloat(r[3] || "0"),
        assoc: parseFloat(r[4] || "0"),
        misc: parseFloat(r[5] || "0"),
        maintenance: parseFloat(r[22] || "0"),
        mop: r[6],
        period: r[7],
        type: r[8],
        notes: r[9],
        notesPrivate: r[10],
        mopRefNo: r[11],
        prDateIssued: r[12],
        prRefNo: r[13],
        creatorName: "",
        name: "",
        stno: "",
        receiptUrl: r[18],
        id: r[19] || crypto.randomUUID(),
        creatorId: r[20] || "",
        accountId: r[21] || ""
      }));
      await addJournalEntries(entries);
      goto("/admin/transactions");
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    pageState.title = "Add Transaction";
  });
</script>

<TransactionForm mode="add" {isSubmitting} onSave={handleSave} />
