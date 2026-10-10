<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { translateCollege, translateProgram } from "$utils/translators";
  import { normalizeStudentNo } from "$utils/student-no";
  import { pluralize } from "$utils/formatters";
  import { parseDateWeight } from "$utils/parsers";
  import * as Card from "$ui/card";
  import * as Tabs from "$ui/tabs";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Label } from "$ui/label";
  import {
    User as UserIcon,
    GraduationCap,
    Clock,
    Mail,
    Send,
    IdCard,
    AwardIcon,
    Contact,
    StickyNote,
    Trash2,
    Info,
    ArrowUpRight,
    FileCheck,
    Banknote,
    Bed,
    BookUser,
    Pencil
  } from "@lucide/svelte";
  import {
    type UserRecord,
    USER_TAG_COLORS,
    type ResidentRecord as Account,
    type ResidentRecord,
    type JournalRecord,
    type OfficerRecord,
    UserTag
  } from "$lib/types";
  import {
    fetchUserById,
    fetchAccountsByUserId,
    fetchResidents,
    deleteUser,
    stageStatusEmail,
    stageClearanceEmail,
    changeAccountType as changeAccountTypeController
  } from "$api/controllers/resident-controller";
  import { fetchJournalEntries } from "$api/controllers/journal-controller";
  import { fetchOfficers } from "$api/controllers/officer-controller";
  import { pageState } from "$state/page-info.svelte";
  import ContentHeader, { type HeaderAction } from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import FinancialStandingCard from "$components/residents/FinancialStandingCard.svelte";
  import ClearanceCard from "$components/residents/ClearanceCard.svelte";
  import ClearanceDialog from "$components/forms/ClearanceDialog.svelte";
  import AccountCard from "$components/residents/AccountCard.svelte";
  import OccupancyHistoryCard from "$components/residents/OccupancyHistoryCard.svelte";
  import OfficerHistoryCard from "$components/residents/OfficerHistoryCard.svelte";
  import TransactionHistoryCard from "$components/residents/TransactionHistoryCard.svelte";
  import RoomActionDialog from "$components/forms/RoomActionDialog.svelte";
  import { toast } from "svelte-sonner";

  const userId = $derived(page.params.id);

  let user = $state<UserRecord | null>(null);
  let accounts = $state<Account[]>([]);
  let userOfficers = $state<OfficerRecord[]>([]);
  let history = $state<JournalRecord[]>([]);
  let allResidents = $state<ResidentRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isClearDialogOpen = $state(false);
  let isDelistOpen = $state(false);
  let residentsToClear = $state<ResidentRecord[]>([]);
  let isChangingType = $state(false);
  let avatarError = $state(false);

  const currentAccount = $derived(accounts.find((a) => a.period === settings.currentTerm) || null);

  const qualifications = $derived(
    user
      ? translateCollege(user.college).map((col, i) => {
          const programs = translateProgram(user!.program);
          return {
            college: col,
            program: programs[i] || "—"
          };
        })
      : []
  );

  async function loadUserProfile(bypassCache = false) {
    if (!userId) {
      return;
    }
    isLoading = true;
    error = null;

    try {
      const [userData, accountData, allOfficers, entries, allRes] = await Promise.all([
        fetchUserById(userId, bypassCache),
        fetchAccountsByUserId(userId, bypassCache),
        fetchOfficers(bypassCache),
        fetchJournalEntries(undefined, undefined),
        fetchResidents(bypassCache)
      ]);

      if (!userData) {
        error = `User with ID ${userId} not found.`;
        return;
      }
      user = userData;
      pageState.title = user.displayName;
      accounts = accountData;
      allResidents = allRes;

      userOfficers = allOfficers.filter(
        (o) =>
          //o.residentId === userId || // FIXME: officer records do not yet store proper UUIDs
          user?.email && o.email?.toLowerCase() === user.email.toLowerCase()
      );

      const journalList = Array.isArray(entries) ? entries : entries.items;
      history = journalList
        .filter(
          (r) =>
            (user?.email && r.account.trim().toLowerCase() === user.email.toLowerCase()) ||
            (user?.studentNo &&
              normalizeStudentNo(r.stno) === normalizeStudentNo(user.studentNo))
        )
        .filter((r) => !settings.currentTerm || r.period === settings.currentTerm)
        .map((journal) => ({
          ...journal,
          dateWeight: parseDateWeight(journal.date)
        }))
        .sort((a, b) => b.dateWeight - a.dateWeight || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0));
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function confirmDelete() {
    if (!user) {
      return;
    }
    globalDialog.confirm(
      "Delete user profile?",
      `The profile and server data for ${user?.displayName ?? "this user"} will be permanently deleted.`,
      undefined,
      async () => {
        if (!user?.id) return;
        try {
          await deleteUser(user.id);
          toast.success("User profile deleted.");
          goto("/admin/users");
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Delete",
        cancel: "Cancel"
      }
    );
  }

  async function handleChangeAccountType(newType: string) {
    if (!currentAccount) {
      return;
    }
    isChangingType = true;
    try {
      await changeAccountTypeController(currentAccount.residentId, currentAccount.period, newType);
      globalDialog.show("Account Type Updated", `Account type changed to ${newType}.`);
      await loadUserProfile(true);
    } catch (e: any) {
      globalDialog.show("Update Failed", e.message);
    } finally {
      isChangingType = false;
    }
  }

  function sendStatusEmail() {
    if (!currentAccount) return;
    stageStatusEmail(currentAccount, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }

  function sendClearanceEmail() {
    if (!currentAccount) return;
    if (!currentAccount.ceLink) {
      globalDialog.show(
        "Dispatch Blocked",
        "No clearance certificate generated for this resident yet."
      );
      return;
    }
    stageClearanceEmail(currentAccount, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }

  async function handleClear() {
    if (!currentAccount) {
      return;
    }
    residentsToClear = [currentAccount];
    isClearDialogOpen = true;
  }

  $effect(() => {
    settings.currentTerm;
    loadUserProfile();
  });

  // Reset the broken-image flag whenever a different user is viewed so a
  // previous error never hides the next user's photo.
  $effect(() => {
    user?.id;
    avatarError = false;
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title={"View User"}
    onRefresh={() => loadUserProfile(true)}
    isRefreshing={isLoading}
    actions={[
      {
        label: "Edit",
        icon: Pencil,
        href: `/admin/users/${userId}/edit`
      },
      ...(currentAccount
        ? [
            {
              label: "Send",
              icon: Mail,
              variant: "outline",
              items: [
                {
                  label: "Send Payment Status",
                  icon: Mail,
                  onclick: sendStatusEmail
                },
                {
                  label: "Send Clearance Certificate",
                  icon: FileCheck,
                  onclick: sendClearanceEmail,
                  disabled:
                    !currentAccount.ceLink ||
                    currentAccount.ceLink === "N/A" ||
                    currentAccount.ceLink === ""
                }
              ]
            }
          ]
        : []),
      ...(accounts.length === 0
        ? [
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onclick: () => confirmDelete(),
              isLoading
            }
          ]
        : [])
    ] as HeaderAction[]}
  >
    {#snippet titleExtra()}
      {#if currentAccount}
        <div class="flex flex-wrap gap-2">
          {#if currentAccount.bal < 0}
            <Badge
              variant="outline"
              class="border-primary/20 bg-primary/5 text-xs font-black tracking-tighter text-primary uppercase"
              >Overpaid</Badge
            >
          {/if}
          {#if currentAccount.bal === 0 && (currentAccount.waterBal < 0 || currentAccount.assocBal < 0)}
            <Badge
              variant="outline"
              class="border-amber-200 bg-amber-100 text-xs font-black tracking-tighter text-amber-700 uppercase"
              >Potential Misassignment</Badge
            >
          {/if}
        </div>
      {/if}
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-4" href="/admin/users">Return to Directory</Button>
    </ErrorView>
  {:else if user}
    <!-- Personal, Academic, and Notes -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- User Profile Card -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <UserIcon class="h-5 w-5" />
            Personal Information
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1 space-y-4">
          {#if user.avatarUrl && !avatarError}
            <div class="flex justify-center pt-1">
              <img
                src={user.avatarUrl}
                alt={user.displayName || `${user.firstName} ${user.lastName}`}
                class="h-24 w-24 shrink-0 rounded-full border border-border object-cover"
                onerror={() => (avatarError = true)}
              />
            </div>
          {/if}
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >First Name</Label
              >
              <p class="text-sm font-semibold">{user.firstName}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Last Name</Label
              >
              <p class="text-sm font-semibold">{user.lastName}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Middle Name</Label
              >
              <p class="text-sm font-semibold">{user.middleName || "—"}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Suffix</Label
              >
              <p class="text-sm font-semibold">{user.suffix || "—"}</p>
            </div>
          </div>

          {#if user.overrideName}
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Override Name</Label
              >
              <p class="text-sm font-semibold text-primary">{user.overrideName}</p>
            </div>
          {/if}

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <Mail class="h-3 w-3" /> Email Address
            </Label>
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-foreground">{user.email}</p>
              <a
                href="mailto:{user.email}"
                class="text-muted-foreground transition-colors hover:text-primary"
              >
                <Send class="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {#if user.secondaryContact}
            <div class="space-y-1">
              <Label
                class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
              >
                <Contact class="h-3 w-3" /> Secondary Contact
              </Label>
              <p class="text-sm font-semibold">{user.secondaryContact}</p>
            </div>
          {/if}

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <IdCard class="h-3 w-3" /> Student Number
            </Label>
              <p class="text-sm font-semibold">{normalizeStudentNo(user.studentNo)}</p>
          </div>

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <UserIcon class="h-3 w-3" /> User Tags
            </Label>
            <div class="flex flex-wrap gap-1">
              {#each (user.tags || UserTag.STUDENT)
                .split(":")
                .map((t) => t.trim())
                .filter(Boolean) as t}
                <Badge
                  variant="outline"
                  class="text-xs font-semibold {USER_TAG_COLORS[t] || USER_TAG_COLORS.DEFAULT}"
                >
                  {t}
                </Badge>
              {/each}
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Academic Card -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <GraduationCap class="h-5 w-5" />
            Academic Details
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1 space-y-6">
          <div class="space-y-4">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              Programs & Colleges
            </Label>
            <div
              class="relative space-y-6 before:absolute before:top-2 before:left-2.75 before:h-[calc(100%-16px)] before:w-px before:bg-border"
            >
              {#each qualifications as q}
                <div class="relative flex items-start gap-4 pl-8">
                  <div
                    class="absolute left-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-background bg-muted shadow-sm ring-1 ring-border"
                  >
                    <AwardIcon class="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span
                      class="text-xs font-bold tracking-widest text-primary uppercase opacity-80"
                      >{q.college}</span
                    >
                    <p class="text-sm leading-tight font-bold text-foreground">{q.program}</p>
                  </div>
                </div>
              {/each}
              {#if qualifications.length === 0}
                <div class="flex flex-col items-center justify-center py-8 opacity-30">
                  <GraduationCap class="mb-2 h-8 w-8" />
                  <p class="text-xs font-bold tracking-widest uppercase">No academic records</p>
                </div>
              {/if}
            </div>
          </div>

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <Clock class="h-3 w-3" /> Terms active
            </Label>
            <div class="text-sm font-semibold">
              {pluralize(accounts.length, "Term", "Terms")}
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Notes Card -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <StickyNote class="h-5 w-5" />
            Notes
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1">
          {#if user.notes}
            <p class="text-sm leading-relaxed whitespace-pre-wrap">
              {user.notes}
            </p>
          {:else}
            <EmptyView
              title="No notes available."
              description="No notes have been recorded for this user."
            >
              {#snippet icon()}
                <StickyNote class="h-8 w-8 text-muted-foreground/40" />
              {/snippet}
            </EmptyView>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <Tabs.Root value="finance" class="space-y-4 pt-2">
      <Tabs.List class="grid w-full max-w-md grid-cols-3">
        <Tabs.Trigger value="finance" class="flex items-center gap-1.5">
          <Banknote class="h-4 w-4" />
          Finance
        </Tabs.Trigger>
        <Tabs.Trigger value="occupancy" class="flex items-center gap-1.5">
          <Bed class="h-4 w-4" />
          Occupancy
        </Tabs.Trigger>
        <Tabs.Trigger value="officership" class="flex items-center gap-1.5">
          <BookUser class="h-4 w-4" />
          Officership
        </Tabs.Trigger>
      </Tabs.List>

      <!-- (1) Finance Tab -->
      <Tabs.Content value="finance" class="space-y-6">
        {#if currentAccount}
          <!-- Occupancy, Financial & Clearance Info for selected term -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <AccountCard
              account={currentAccount}
              avatarUrl={user?.avatarUrl || ""}
              {isChangingType}
              onChangeAccountType={handleChangeAccountType}
              onDelist={() => {
                isDelistOpen = true;
              }}
            />

            <div class="flex h-full flex-col gap-6">
              <FinancialStandingCard account={currentAccount}>
                {#snippet actions()}
                  {#if currentAccount}
                    <Button
                      variant="secondary"
                      size="sm"
                      class="w-full"
                      href="/admin/transactions/add?account={currentAccount.stno}"
                      icon={ArrowUpRight}
                    >
                      Add Transaction
                    </Button>
                  {/if}
                {/snippet}
              </FinancialStandingCard>

              {#if currentAccount.notes?.trim()}
                <Card.Root class="border-amber-200 bg-amber-50/30">
                  <Card.Header>
                    <Card.Title class="flex items-center gap-2 text-sm text-amber-900">
                      <Info class="h-4 w-4" /> Account Notes
                    </Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <p class="text-xs leading-relaxed font-medium text-amber-800">
                      {@html currentAccount.notes}
                    </p>
                  </Card.Content>
                </Card.Root>
              {/if}
            </div>

            <ClearanceCard account={currentAccount} onClear={handleClear} />
          </div>

          <!-- Transaction History -->
          <TransactionHistoryCard
            {history}
            onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
          />
        {:else}
          <EmptyView
            title="No account record found for this term."
            description="This user has no registered account or occupancy record for the selected academic term."
            class="h-60"
          >
            {#snippet icon()}
              <Bed class="h-8 w-8 text-muted-foreground/40" />
            {/snippet}
          </EmptyView>
        {/if}
      </Tabs.Content>

      <!-- (2) Occupancy Tab -->
      <Tabs.Content value="occupancy" class="space-y-4">
        <OccupancyHistoryCard {accounts} onRowClick={(r) => (settings.currentTerm = r.period)} />
      </Tabs.Content>

      <!-- (3) Officership Tab -->
      <Tabs.Content value="officership" class="space-y-4">
        <OfficerHistoryCard
          officers={userOfficers}
          residentId={userId}
          onRowClick={(o) => goto(`/admin/residents/officers/${o.id}`)}
        />
      </Tabs.Content>
    </Tabs.Root>
  {/if}
</div>

{#if currentAccount}
  <RoomActionDialog
    bind:open={isDelistOpen}
    room={currentAccount.room}
    bed={currentAccount.bed}
    userId={currentAccount.residentId}
    isOccupied={true}
    activeTerm={settings.currentTerm}
    userOptions={[]}
    availableBedOptions={[]}
    onSuccess={async () => {
      await loadUserProfile(true);
    }}
  />
{/if}

<ClearanceDialog
  bind:open={isClearDialogOpen}
  residents={residentsToClear}
  onSuccess={(count) => {
    globalDialog.show("Success", `${pluralize(count, "resident", "residents")} marked as cleared.`);
  }}
/>
