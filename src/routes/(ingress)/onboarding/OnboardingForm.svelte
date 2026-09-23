<script lang="ts">
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Checkbox } from "$ui/checkbox";
  import {
    ChevronLeft,
    ChevronRight,
    RefreshCcw,
    Star,
    GraduationCap,
    Clock,
    CircleAlert,
    LogOut
  } from "@lucide/svelte";
  import * as RadioGroup from "$ui/radio-group";
  import colleges from "$assets/colleges.json";
  import programs from "$assets/programs.json";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { auth } from "$state/auth.svelte";
  import { ACCOUNT_TYPE_LABELS, AccountType } from "$lib/types";
  import { isStudentNoTaken, registerResident } from "$api/controllers/resident-controller";

  import { residentState, type ResidentStatus } from "$state/resident-state.svelte";
  import { roomsState } from "$state/rooms.svelte";
  import { translatePeriod } from "$utils/translators";
  import * as Stepper from "$ui/stepper";
  import { globalDialog } from "$state/dialog.svelte";

  let { status, onSuccess }: { status: ResidentStatus; onSuccess: () => Promise<void> } = $props();

  let isSubmitting = $state(false);
  let step = $state(untrack(() => (status.waitingForConfirmation ? 4 : 1)));
  let isOutdated = $state(false);
  const emailVal = $derived(status.profile?.email || auth.user?.email || "");
  const isUpMail = $derived(emailVal.endsWith("@up.edu.ph"));
  const blockStudentNoChange = $derived(!!status.profile?.studentNo);

  $effect(() => {
    if (status.waitingForConfirmation) {
      step = 4;
    } else if (!status.hasActiveAccount) {
      isSubmitting = false;
      step = 1;
    }
  });

  let allowedAccountTypes = $state<AccountType[]>([
    AccountType.STUDENT,
    AccountType.TRANSIENT,
    AccountType.BOOTCAMP
  ]);

  let accountType = $state(AccountType.STUDENT);
  let hasStudentNo = $state(true);

  const accountTypeOptions = $derived(
    [
      {
        value: AccountType.STUDENT,
        label: ACCOUNT_TYPE_LABELS.STUDENT,
        disabled: !isUpMail
      },
      { value: AccountType.TRANSIENT, label: ACCOUNT_TYPE_LABELS.TRANSIENT },
      {
        value: AccountType.BOOTCAMP,
        label: ACCOUNT_TYPE_LABELS.BOOTCAMP,
        disabled: blockStudentNoChange
      }
    ].filter((opt) => allowedAccountTypes.includes(opt.value))
  );

  const isAccountTypeDisabled = $derived(allowedAccountTypes.length <= 1);

  let selectedOption = $state<string>("1");

  async function handleProceedStep1() {
    await selectOption(Number(selectedOption));
  }

  async function selectOption(optionId: number) {
    if (isSubmitting) return;

    if (optionId === 1) {
      accountType = AccountType.STUDENT;
      allowedAccountTypes = [AccountType.STUDENT, AccountType.BOOTCAMP];
      step = 2;
    } else if (optionId === 2) {
      accountType = AccountType.TRANSIENT;
      allowedAccountTypes = [AccountType.TRANSIENT];
      step = 2;
    }
  }

  async function handleCheckStatus() {
    isSubmitting = false;
    await residentState.refresh();
    if (residentState.error) {
      toast.error(residentState.error);
      return;
    }
    if (residentState.status) {
      if (residentState.status.hasActiveAccount || !residentState.status.waitingForConfirmation) {
        goto("/resident");
      }
    }
  }

  let requireSocialMedia = $derived(
    accountType === AccountType.STUDENT || accountType === AccountType.BOOTCAMP
  );

  $effect(() => {
    if (status) {
      const isAllowed = allowedAccountTypes.includes(accountType);
      const isDisabled = accountType === AccountType.STUDENT && !isUpMail;

      if (!isAllowed || isDisabled) {
        const firstEnabled = accountTypeOptions.find((opt) => !opt.disabled);
        if (firstEnabled) {
          accountType = firstEnabled.value;
          if (accountType !== AccountType.STUDENT && accountType !== AccountType.BOOTCAMP) {
            hasStudentNo = false;
          }
        }
      }
    }
  });

  let useLivedName = $state(false);

  let formData = $state({
    room: "",
    bed: "",
    studentNo: "",
    college: "",
    program: "",
    firstName: "",
    lastName: "",
    suffix: "",
    overrideName: "",
    checkInDate: "",
    likedFBPage: false,
    joinedFBGroup: false,
    joinedFBChat: false
  });

  $effect(() => {
    if (status) {
      formData.room = formData.room || status.currEntry?.room || status.account?.room || "";
      formData.bed = formData.bed || status.currEntry?.bed || status.account?.bed || "";
      formData.studentNo =
        formData.studentNo || status.currEntry?.studentNo || status.profile?.studentNo || "";
      formData.college =
        formData.college ||
        status.currEntry?.college ||
        (status.profile?.college || "").split(",").pop()?.trim() ||
        "";
      formData.program =
        formData.program ||
        status.currEntry?.program ||
        (status.profile?.program || "").split(":").pop()?.trim() ||
        "";
      formData.firstName =
        formData.firstName ||
        status.currEntry?.firstName ||
        status.profile?.firstName ||
        auth.user?.firstName ||
        "";
      formData.lastName =
        formData.lastName ||
        status.currEntry?.lastName ||
        status.profile?.lastName ||
        auth.user?.lastName ||
        "";
      formData.suffix =
        formData.suffix ||
        status.currEntry?.suffix ||
        status.profile?.suffix ||
        auth.user?.suffix ||
        "";
      formData.overrideName =
        formData.overrideName ||
        status.currEntry?.overrideName ||
        status.profile?.overrideName ||
        auth.user?.overrideName ||
        "";
      if (formData.overrideName) {
        useLivedName = true;
      }
      formData.checkInDate = formData.checkInDate || status.currEntry?.checkInDate || "";
    }
  });

  async function handleSubmit() {
    const isStudentNoRequired = accountType === AccountType.STUDENT || hasStudentNo;

    if (!useLivedName) {
      formData.overrideName = "";
    }

    if (useLivedName && !formData.overrideName.trim()) {
      toast.error("Please fill in your preferred lived name.");
      return;
    }

    if (
      !formData.room ||
      !formData.bed ||
      !formData.checkInDate ||
      (!formData.studentNo && isStudentNoRequired) ||
      !formData.college ||
      !formData.program ||
      (requireSocialMedia &&
        (!formData.likedFBPage || !formData.joinedFBGroup || !formData.joinedFBChat))
    ) {
      toast.error("Please fill in all fields.");
      return;
    }

    isSubmitting = true;
    try {
      if (isStudentNoRequired && formData.studentNo) {
        const taken = await isStudentNoTaken(formData.studentNo);
        if (taken) {
          globalDialog.show(
            "Student Number Already Used",
            `Student number ${formData.studentNo.toUpperCase()} is already registered to another resident. Please double-check your student number.`
          );
          isSubmitting = false;
          return;
        }
      }

      await registerResident({
        ...formData,
        studentNo: isStudentNoRequired ? formData.studentNo : "",
        accountType,
        email: status.profile?.email || auth.user?.email,
        term: status.systemActiveTerm
      });

      residentState.forceOnboarding = false;
      await onSuccess();
    } catch (e: any) {
      globalDialog.show(
        "Registration Failed",
        e.message || "An error occurred while submitting your registration."
      );
      isSubmitting = false;
    }
  }

  const roomOptions = $derived(
    roomsState.config
      .filter((r) => !r.unavailable_reason)
      .map((r) => ({ value: r.room_number, label: r.room_number }))
  );

  const selectedRoomConfig = $derived(
    roomsState.config.find((r) => r.room_number === formData.room)
  );

  const bedOptions = $derived(
    selectedRoomConfig
      ? selectedRoomConfig.slots.map((s) => {
          const isOccupiedByOther = status.occupiedBeds?.some(
            (ob: any) => ob.room === formData.room && ob.bed === s
          );
          return {
            value: s,
            label: `Bed ${s}${isOccupiedByOther ? " (Taken)" : ""}`,
            disabled:
              (!selectedRoomConfig.available_slots.includes(s) || isOccupiedByOther) &&
              formData.bed !== s
          };
        })
      : []
  );

  const collegeOptions = Object.entries(colleges).map(([code, name]) => ({
    value: code,
    label: name as string
  }));

  const programOptions = Object.entries(programs).map(([code, name]) => ({
    value: code,
    label: name as string
  }));

  const isStudentNoDisabled = $derived(
    !!(status.profile?.studentNo || status.currEntry?.studentNo)
  );

  const isAcademicDisabled = $derived(
    !!(status.profile?.college && status.profile?.program && !isOutdated)
  );

  const isRoomComplete = $derived(!!(formData.room && formData.bed && formData.checkInDate));
  const isProfileComplete = $derived.by(() => {
    const isStudentNoRequired = accountType === AccountType.STUDENT || hasStudentNo;
    const needsNameEntry =
      !status.isRegistered || !status.profile?.firstName || !status.profile?.lastName;
    if (needsNameEntry) {
      if (!formData.firstName || !formData.lastName) return false;
    }
    if (useLivedName && !formData.overrideName.trim()) return false;
    if (!formData.college || !formData.program) return false;
    if (isStudentNoRequired && !formData.studentNo) return false;
    if (
      requireSocialMedia &&
      (!formData.likedFBPage || !formData.joinedFBGroup || !formData.joinedFBChat)
    )
      return false;
    return true;
  });
</script>

<Stepper.Root bind:step>
  <div class="flex flex-col gap-8">
    <Stepper.Nav orientation="horizontal" class="justify-between">
      <Stepper.Item class="flex-1">
        <Stepper.Trigger disabled={true}>
          <Stepper.Indicator>1</Stepper.Indicator>
          <Stepper.Title hideTitle="inactive">Welcome</Stepper.Title>
        </Stepper.Trigger>
        <Stepper.Separator />
      </Stepper.Item>
      <Stepper.Item class="flex-1">
        <Stepper.Trigger disabled={true}>
          <Stepper.Indicator>2</Stepper.Indicator>
          <Stepper.Title hideTitle="inactive">Profile</Stepper.Title>
        </Stepper.Trigger>
        <Stepper.Separator />
      </Stepper.Item>
      <Stepper.Item class="flex-1">
        <Stepper.Trigger disabled={true}>
          <Stepper.Indicator>3</Stepper.Indicator>
          <Stepper.Title hideTitle="inactive">Room</Stepper.Title>
        </Stepper.Trigger>
        <Stepper.Separator />
      </Stepper.Item>
      <Stepper.Item class="flex-1">
        <Stepper.Trigger disabled={true}>
          <Stepper.Indicator>4</Stepper.Indicator>
          <Stepper.Title hideTitle="inactive">Evaluation</Stepper.Title>
        </Stepper.Trigger>
      </Stepper.Item>
    </Stepper.Nav>

    <div class="min-h-75">
      {#if step === 1}
        <div class="space-y-6">
          {#if status.currEntry?.declineReason}
            <div
              class="flex items-start gap-3 rounded-lg border-2 border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
            >
              <CircleAlert class="mt-0.5 h-5 w-5 shrink-0" />
              <div class="space-y-1">
                <p class="font-bold">Previous Registration Declined</p>
                <p class="text-xs text-foreground">
                  {status.currEntry.declineReason}
                </p>
                <p class="text-xs text-foreground">
                  Please select your residency type below to submit a new registration.
                </p>
              </div>
            </div>
          {/if}

          <RadioGroup.Root bind:value={selectedOption} class="flex flex-col gap-3">
            <RadioGroup.Card
              value="1"
              title="Student or Associate Degree Candidate"
              description="Register your room and bed assignment for the semester."
              icon={GraduationCap}
              selected={selectedOption === "1"}
            />
            <RadioGroup.Card
              value="2"
              title="Transient Resident"
              description="Register for short-term residency."
              icon={Clock}
              selected={selectedOption === "2"}
            />
          </RadioGroup.Root>

          <div class="flex items-center justify-between pt-6">
            {#if status.isRegistered && residentState.forceOnboarding}
              <Button
                variant="outline"
                onclick={() => {
                  residentState.forceOnboarding = false;
                  goto("/resident");
                }}
              >
                Cancel
              </Button>
            {:else}
              <Button
                variant="outline"
                onclick={() => {
                  auth.signOut();
                  goto("/sign-in");
                }}
                icon={LogOut}
              >
                Sign out
              </Button>
            {/if}
            <Button
              onclick={handleProceedStep1}
              isLoading={isSubmitting}
              icon={ChevronRight}
              iconPosition="right"
            >
              Next
            </Button>
          </div>
        </div>
      {:else if step === 2}
        <div class="space-y-6">
          <div class="space-y-4">
            {#if !status.isRegistered || !status.profile?.firstName || !status.profile?.lastName}
              <div class="grid gap-4 md:grid-cols-3">
                <div class="space-y-2">
                  <Label for="firstName">First Name</Label>
                  <Input id="firstName" bind:value={formData.firstName} />
                </div>
                <div class="space-y-2">
                  <Label for="lastName">Last Name</Label>
                  <Input id="lastName" bind:value={formData.lastName} />
                </div>
                <div class="space-y-2">
                  <Label for="suffix"
                    >Suffix <span class="text-xs font-normal text-muted-foreground">(Optional)</span
                    ></Label
                  >
                  <Input id="suffix" bind:value={formData.suffix} placeholder="Jr., III, etc." />
                </div>
              </div>
            {/if}

            <div class="space-y-3 rounded-lg border bg-card p-3.5 text-card-foreground">
              <div class="flex items-center space-x-3">
                <Checkbox id="useLivedName" bind:checked={useLivedName} />
                <Label for="useLivedName" class="cursor-pointer text-sm font-medium">
                  I would prefer to use a lived name for transactions
                </Label>
              </div>
              {#if useLivedName}
                <div class="animate-in space-y-2 pt-1.5 duration-200 fade-in slide-in-from-top-1">
                  <Label for="overrideName">Lived Name / Preferred Name</Label>
                  <Input
                    id="overrideName"
                    bind:value={formData.overrideName}
                    placeholder="Enter preferred display name…"
                  />
                  <p class="text-xs text-muted-foreground">
                    This will override your name on receipts and transactions.
                  </p>
                </div>
              {/if}
            </div>
            <div class="space-y-2">
              <Label>Account Type</Label>
              <Combobox
                bind:value={accountType}
                options={accountTypeOptions}
                placeholder="Select account type…"
                class="w-full"
                disabled={isAccountTypeDisabled}
              />
            </div>

            {#if !blockStudentNoChange && accountType !== AccountType.STUDENT}
              <div class="flex items-center space-x-3 py-2">
                <Checkbox id="hasStudentNo" bind:checked={hasStudentNo} />
                <Label for="hasStudentNo" class="cursor-pointer text-sm font-medium">
                  I have a student number
                </Label>
              </div>
            {/if}

            {#if hasStudentNo || accountType === AccountType.STUDENT}
              <div class="space-y-2">
                <Label for="studentNo">Student Number</Label>
                <Input
                  id="studentNo"
                  bind:value={formData.studentNo}
                  placeholder="XXXX-XXXXX"
                  disabled={isStudentNoDisabled}
                />
              </div>
            {:else}
              <div class="rounded-lg bg-muted/50 p-3">
                A random temporary identifier code will be automatically assigned as your student
                number.
              </div>
            {/if}
            <div class="space-y-4">
              <div class="space-y-2">
                <Label>College</Label>
                <Combobox
                  bind:value={formData.college}
                  options={collegeOptions}
                  placeholder="Search college…"
                  class="w-full"
                  disabled={isAcademicDisabled}
                />
              </div>
              <div class="space-y-2">
                <Label>Degree Program</Label>
                <Combobox
                  bind:value={formData.program}
                  options={programOptions}
                  placeholder="Search program…"
                  class="w-full"
                  disabled={!formData.college || isAcademicDisabled}
                />
              </div>

              {#if status.profile?.college}
                <div class="flex items-start space-x-3 pt-2">
                  <Checkbox id="outdated" bind:checked={isOutdated} />
                  <div class="grid gap-1.5 leading-none">
                    <Label
                      for="outdated"
                      class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      My UPLB college/degree program details are outdated
                    </Label>
                    <p class="text-sm text-muted-foreground">
                      Checking this allows you to request an update to your academic profile.
                    </p>
                  </div>
                </div>
              {/if}
            </div>

            {#if requireSocialMedia}
              <div class="space-y-4 rounded-xl border bg-muted/20 p-4">
                <Label
                  class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
                >
                  <Star class="h-3.5 w-3.5" /> Social Media Requirements
                </Label>
                <div class="space-y-4">
                  <div class="flex items-center gap-3">
                    <Checkbox id="fb-page" bind:checked={formData.likedFBPage} />
                    <Label for="fb-page" class="text-sm leading-none font-medium">
                      <span
                        >I have liked the <span class="text-primary underline hover:text-primary/80"
                          >Official Facebook Page</span
                        > of the Association</span
                      >
                    </Label>
                  </div>
                  <div class="flex items-center gap-3">
                    <Checkbox id="fb-group" bind:checked={formData.joinedFBGroup} />
                    <Label for="fb-group" class="text-sm leading-none font-medium">
                      <span
                        >I have joined the <span
                          class="text-primary underline hover:text-primary/80"
                          >Official Facebook Group</span
                        > of the Association</span
                      >
                    </Label>
                  </div>
                  <div class="flex items-center gap-3">
                    <Checkbox id="fb-chat" bind:checked={formData.joinedFBChat} />
                    <Label for="fb-chat" class="text-sm leading-none font-medium">
                      <span
                        >I have joined the <span
                          class="text-primary underline hover:text-primary/80"
                          >Official Facebook Messenger Group Chat</span
                        > of the Residence Hall</span
                      >
                    </Label>
                  </div>
                </div>
              </div>
            {:else}
              <div class="rounded-lg bg-muted/50 p-3">
                Choose No College Information and No Degree Program Information if you did not
                attend UPLB as a student.
              </div>
            {/if}
          </div>
          <div class="flex justify-between pt-6">
            <Stepper.Previous disabled={isSubmitting}>
              <ChevronLeft class="mr-2 h-4 w-4" />
              Back
            </Stepper.Previous>
            <Stepper.Next disabled={!isProfileComplete}>
              Next
              <ChevronRight class="ml-2 h-4 w-4" />
            </Stepper.Next>
          </div>
        </div>
      {:else if step === 3}
        <div class="space-y-6">
          <div class="grid gap-6 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="room">Room Number</Label>
              <Combobox
                bind:value={formData.room}
                options={roomOptions}
                placeholder="Search room…"
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <Label for="bed">Bed Assignment</Label>
              <Combobox
                bind:value={formData.bed}
                options={bedOptions}
                placeholder="Select a bed…"
                class="w-full"
                disabled={!formData.room}
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="checkInDate">Expected Check-in Date</Label>
            <Input id="checkInDate" type="date" bind:value={formData.checkInDate} class="w-full" />
          </div>

          <div class="flex justify-between pt-6">
            <Stepper.Previous disabled={isSubmitting}>
              <ChevronLeft class="mr-2 h-4 w-4" />
              Back
            </Stepper.Previous>
            <Button
              onclick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!isRoomComplete}
              icon={ChevronRight}
              iconPosition="right"
            >
              {isSubmitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      {:else if step === 4}
        <div class="space-y-6">
          <div class="space-y-4">
            <p class="leading-relaxed">
              We've received your registration for
              <strong>{translatePeriod(status.activeTerm) || "the current term"}</strong>.
            </p>
            <p>
              An administrator is currently reviewing your assignment. This usually takes less than
              24 hours. You'll be able to access the dashboard once your record is evaluated.
            </p>
          </div>

          {#if residentState.error}
            <div
              class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              Couldn't refresh your status: {residentState.error}. Please try again.
            </div>
          {/if}

          <Button
            onclick={handleCheckStatus}
            isLoading={residentState.isLoading}
            icon={RefreshCcw}
            class="w-full"
          >
            Check Status
          </Button>
        </div>
      {/if}
    </div>
  </div>
</Stepper.Root>
