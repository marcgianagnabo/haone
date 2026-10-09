<script lang="ts">
  import * as Card from "$ui/card";
  import { Label } from "$ui/label";
  import { Button } from "$ui/button";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import { MapPin, Bed as BedIcon, Calendar, UserCog, Pencil, ArrowUpRight } from "@lucide/svelte";
  import { type ResidentRecord, AccountType, ACCOUNT_TYPE_LABELS } from "$lib/types";
  import { formatDate } from "$utils/formatters";
  import { translateAccountType } from "$utils/translators";

  interface Props {
    account: ResidentRecord;
    class?: string;
    avatarUrl?: string;
    isChangingType?: boolean;
    onChangeAccountType?: (newType: string) => void;
    onDelist?: () => void;
  }

  let {
    account,
    class: className,
    avatarUrl = "",
    isChangingType = false,
    onChangeAccountType,
    onDelist
  }: Props = $props();

  let imgError = $state(false);

  // Reset the broken-image flag when the account or photo changes so a
  // previous error never hides a newly loaded photo.
  $effect(() => {
    account?.residentId;
    avatarUrl;
    imgError = false;
  });

  const ACCOUNT_TYPE_OPTIONS = [
    { value: AccountType.STUDENT, label: ACCOUNT_TYPE_LABELS.STUDENT },
    { value: AccountType.TRANSIENT, label: ACCOUNT_TYPE_LABELS.TRANSIENT },
    { value: AccountType.BOOTCAMP, label: ACCOUNT_TYPE_LABELS.BOOTCAMP },
    { value: AccountType.ALUMNUS, label: ACCOUNT_TYPE_LABELS.ALUMNUS },
    { value: AccountType.FACULTY, label: ACCOUNT_TYPE_LABELS.FACULTY },
    { value: AccountType.STAFF, label: ACCOUNT_TYPE_LABELS.STAFF },
    { value: AccountType.REPS, label: ACCOUNT_TYPE_LABELS.REPS }
  ];
</script>

<Card.Root class="flex h-full flex-col {className}">
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg">
      <BedIcon class="h-5 w-5" />
      Account
    </Card.Title>
  </Card.Header>
  <Card.Content class="flex-1 space-y-4">
    {#if (avatarUrl || "").trim() && !imgError}
      <div class="flex items-center gap-3">
        <img
          src={(avatarUrl || "").trim()}
          alt={account.name || account.email}
          class="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
          onerror={() => (imgError = true)}
        />
        <div class="min-w-0">
          {#if account.name}
            <p class="truncate text-sm font-bold text-foreground">{account.name}</p>
          {/if}
          <p class="truncate text-xs text-muted-foreground">{account.email}</p>
        </div>
      </div>
    {/if}
    <div class="space-y-1">
      <Label
        class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
      >
        <UserCog class="h-3 w-3" /> Account Type
      </Label>
      <div class="flex items-center gap-2">
        <p class="text-sm font-semibold text-foreground">
          {translateAccountType(account.type)}
        </p>
        {#if onChangeAccountType}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <button
                  type="button"
                  {...props}
                  class="text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                  title="Change Account Type"
                  disabled={isChangingType}
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-48">
              {#each ACCOUNT_TYPE_OPTIONS as opt}
                <DropdownMenu.Item
                  onclick={() => onChangeAccountType(opt.value)}
                  class={account.type === opt.value ? "font-bold text-primary" : ""}
                >
                  {opt.label}
                  {#if account.type === opt.value}
                    <span class="ml-auto text-xs text-primary">✓</span>
                  {/if}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
      <div class="space-y-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        >
          <MapPin class="h-3 w-3" /> Room
        </Label>
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-semibold">{account.room || "—"}</span>
          {#if account.room}
            <a
              href="/admin/residents/rooms/{account.room}"
              class="text-muted-foreground transition-colors hover:text-primary"
              title="View Room {account.room}"
            >
              <ArrowUpRight class="h-3.5 w-3.5" />
            </a>
          {/if}
        </div>
      </div>
      <div class="space-y-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        >
          <BedIcon class="h-3 w-3" /> Bed
        </Label>
        <p class="text-sm font-semibold">{account.bed || "—"}</p>
      </div>
      {#if account.checkInDate}
        <div class="space-y-1 sm:col-span-2">
          <Label
            class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >
            <Calendar class="h-3 w-3" /> Check-in Date
          </Label>
          <p class="text-sm font-semibold">{formatDate(account.checkInDate)}</p>
        </div>
      {/if}
    </div>
  </Card.Content>
  {#if onDelist}
    <Card.Footer class="flex flex-col gap-2">
      <Button variant="destructive" size="sm" class="w-full" onclick={onDelist}>
        Delist Resident
      </Button>
    </Card.Footer>
  {/if}
</Card.Root>
