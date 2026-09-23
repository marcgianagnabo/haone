<script lang="ts">
  import * as Card from "$ui/card";
  import { Label } from "$ui/label";
  import { formatCurrency, formatAmount } from "$utils/formatters";
  import { CreditCard, Droplets, Users, Wallet, Wrench } from "@lucide/svelte";
  import type { ResidentRecord } from "$lib/types";

  interface Props {
    account: ResidentRecord;
    class?: string;
    hideCard?: boolean;
    actions?: import("svelte").Snippet;
  }

  let { account, class: className, hideCard = false, actions }: Props = $props();
</script>

{#snippet financialContent()}
  <div class="space-y-6">
    <!-- Water Fee Section -->
    <div class="space-y-3">
      <div class="pb-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        >
          <Droplets class="h-3 w-3" /> Water Fee
        </Label>
      </div>
      <div
        class="grid grid-cols-4 gap-2 text-center text-xs font-bold text-muted-foreground uppercase"
      >
        <div class="flex flex-col gap-0.5">
          <span>Base</span>
          <span class="text-foreground">{formatAmount(account.waterBase)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Paid</span>
          <span class="text-foreground">{formatAmount(account.waterPaid)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Waived</span>
          <span class="text-foreground">{formatAmount(account.waterWaived)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Balance</span>
          <span class="text-foreground {account.waterBal < 0 ? 'text-primary' : ''}"
            >{formatAmount(account.waterBal)}</span
          >
        </div>
      </div>
    </div>

    <!-- Association Fee Section -->
    <div class="space-y-3">
      <div class="pb-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        >
          <Users class="h-3 w-3" /> Association Fee
        </Label>
      </div>
      <div
        class="grid grid-cols-4 gap-2 text-center text-xs font-bold text-muted-foreground uppercase"
      >
        <div class="flex flex-col gap-0.5">
          <span>Base</span>
          <span class="text-foreground">{formatAmount(account.assocBase)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Paid</span>
          <span class="text-foreground">{formatAmount(account.assocPaid)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Waived</span>
          <span class="text-foreground">{formatAmount(account.assocWaived)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Balance</span>
          <span class="text-foreground {account.assocBal < 0 ? 'text-primary' : ''}"
            >{formatAmount(account.assocBal)}</span
          >
        </div>
      </div>
    </div>

    <!-- Maintenance Fee Section -->
    <div class="space-y-3">
      <div class="pb-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        >
          <Wrench class="h-3 w-3" /> Maintenance & Gas Fee
        </Label>
      </div>
      <div
        class="grid grid-cols-4 gap-2 text-center text-xs font-bold text-muted-foreground uppercase"
      >
        <div class="flex flex-col gap-0.5">
          <span>Base</span>
          <span class="text-foreground">{formatAmount(account.maintenanceBase || 0)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Paid</span>
          <span class="text-foreground">{formatAmount(account.maintenancePaid || 0)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Waived</span>
          <span class="text-foreground">{formatAmount(account.maintenanceWaived || 0)}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span>Balance</span>
          <span class="text-foreground {(account.maintenanceBal || 0) < 0 ? 'text-primary' : ''}"
            >{formatAmount(account.maintenanceBal || 0)}</span
          >
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-1 pt-2">
      <Label
        class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
      >
        <Wallet class="h-3 w-3" /> Total Amount Due
      </Label>
      <div class="text-left">
        <p
          class="text-xl font-bold tabular-nums {account.bal < 0
            ? 'text-primary'
            : 'text-foreground'}"
        >
          {formatCurrency(account.bal)}
        </p>
      </div>
    </div>
  </div>
{/snippet}

{#if hideCard}
  <div class={className}>
    {@render financialContent()}
  </div>
{:else}
  <Card.Root class="flex h-full flex-col {className}">
    <Card.Header>
      <Card.Title class="flex items-center gap-2 text-lg">
        <CreditCard class="h-5 w-5" />
        Financial Standing
      </Card.Title>
    </Card.Header>
    <Card.Content class="flex-1">
      {@render financialContent()}
    </Card.Content>
    {#if actions}
      <Card.Footer>
        {@render actions()}
      </Card.Footer>
    {/if}
  </Card.Root>
{/if}
