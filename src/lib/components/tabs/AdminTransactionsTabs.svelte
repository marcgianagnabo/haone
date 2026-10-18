<script lang="ts">
  import { goto } from "$app/navigation";
  import * as Tabs from "$ui/tabs";
  import { List, Receipt, Banknote } from "@lucide/svelte";

  let {
    active = "all"
  }: {
    active?: "all" | "receipts" | "requests";
  } = $props();

  function handleTabChange(value: string) {
    if (value === "all") {
      goto("/admin/transactions");
    } else if (value === "receipts") {
      goto("/admin/transactions/pending");
    } else if (value === "requests") {
      goto("/admin/transactions/requests");
    }
  }
</script>

<Tabs.Root value={active} onValueChange={handleTabChange}>
  <Tabs.List>
    <Tabs.Trigger value="all" class="flex items-center gap-1.5">
      <List class="h-3.5 w-3.5" />
      All
    </Tabs.Trigger>
    <Tabs.Trigger value="receipts" class="flex items-center gap-1.5">
      <Receipt class="h-3.5 w-3.5" />
      Receipts
    </Tabs.Trigger>
    <Tabs.Trigger value="requests" class="flex items-center gap-1.5">
      <Banknote class="h-3.5 w-3.5" />
      Requests
    </Tabs.Trigger>
  </Tabs.List>
</Tabs.Root>
