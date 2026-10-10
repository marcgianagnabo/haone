<script lang="ts">
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import * as Card from "$ui/card";
  import * as Dialog from "$ui/dialog";
  import {
    Save,
    User as UserIcon,
    IdCard,
    GraduationCap,
    UserCog,
    Plus,
    Trash2,
    AwardIcon
  } from "@lucide/svelte";
  import { type UserRecord, UserTag, USER_TAG_LABELS } from "$lib/types";
  import { translateCollege, translateProgram } from "$utils/translators";
  import collegesJson from "$assets/colleges.json";
  import programsJson from "$assets/programs.json";
  import { TagsInput } from "$ui/tags-input";
  import { Combobox } from "$ui/combobox";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { maskStudentNoInput } from "$utils/student-no";

  let {
    formData = $bindable({}),
    userTypes = $bindable([]),
    academicItems = $bindable([]),
    isSaving = false,
    onSave,
    title = "User Information"
  }: {
    formData: Partial<UserRecord>;
    userTypes: string[];
    academicItems: { college: string; program: string }[];
    isSaving?: boolean;
    onSave: () => void;
    title?: string;
  } = $props();

  const allUserTags = Object.values(UserTag);

  const collegeOptions = $derived.by(() => {
    const options = Object.entries(collegesJson).map(([k, v]) => ({ value: k, label: v }));
    academicItems.forEach((item) => {
      if (item.college && !options.find((o) => o.value === item.college)) {
        options.push({
          value: item.college,
          label: translateCollege(item.college)[0] || item.college
        });
      }
    });
    return options;
  });

  const programOptions = $derived.by(() => {
    const options = Object.entries(programsJson).map(([k, v]) => ({ value: k, label: v }));
    academicItems.forEach((item) => {
      if (item.program && !options.find((o) => o.value === item.program)) {
        options.push({
          value: item.program,
          label: translateProgram(item.program)[0] || item.program
        });
      }
    });
    return options;
  });

  function validateTag(val: string, tags: string[]) {
    const transformed = val.trim().toUpperCase();
    if (!transformed) return undefined;
    if (tags.includes(transformed)) return undefined;

    if (transformed === UserTag.STUDENT && tags.includes(UserTag.ALUMNUS)) {
      return undefined;
    }
    if (transformed === UserTag.ALUMNUS && tags.includes(UserTag.STUDENT)) {
      return undefined;
    }

    return transformed;
  }

  let isDialogOpen = $state(false);
  let editingIndex = $state<number | null>(null);
  let editingItem = $state<{ college: string; program: string }>({ college: "", program: "" });

  function openAddDialog() {
    editingIndex = null;
    editingItem = { college: "", program: "" };
    isDialogOpen = true;
  }

  function openEditDialog(index: number) {
    editingIndex = index;
    editingItem = { ...academicItems[index] };
    isDialogOpen = true;
  }

  function saveAcademicItem() {
    if (editingIndex === null) {
      academicItems = [...academicItems, { ...editingItem }];
    } else {
      academicItems[editingIndex] = { ...editingItem };
    }
    isDialogOpen = false;
  }

  function removeAcademicItem(index: number) {
    academicItems = academicItems.filter((_, i) => i !== index);
  }
</script>

<!-- FIXME: Subpage header should not be handled by this component -->
<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    {title}
    actions={[{ label: "Save", onclick: onSave, isLoading: isSaving, icon: Save }]}
  />

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- Left Column -->
    <div class="space-y-6">
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <UserIcon class="h-5 w-5" />
            Name Information
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="firstName">First Name</Label>
              <Input id="firstName" bind:value={formData.firstName} />
            </div>
            <div class="space-y-2">
              <Label for="lastName">Last Name</Label>
              <Input id="lastName" bind:value={formData.lastName} />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="middleName">Middle Name</Label>
              <Input id="middleName" bind:value={formData.middleName} />
            </div>
            <div class="space-y-2">
              <Label for="suffix">Suffix</Label>
              <Input id="suffix" bind:value={formData.suffix} />
            </div>
          </div>

          <div class="space-y-2 pt-2">
            <Label for="overrideName">Override Display Name</Label>
            <Input
              id="overrideName"
              bind:value={formData.overrideName}
              placeholder="Leave blank to use default"
            />
            <p class="text-xs text-muted-foreground italic">
              Useful for residents who prefer a different name on certificates.
            </p>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="pb-3">
          <Card.Title class="flex items-center justify-between text-lg">
            <div class="flex items-center gap-2">
              <GraduationCap class="h-5 w-5" />
              Academic Info
            </div>
            <Button variant="ghost" size="icon" onclick={openAddDialog} class="h-8 w-8">
              <Plus class="h-4 w-4" />
            </Button>
          </Card.Title>
        </Card.Header>
        <Card.Content class="pb-6">
          {#if academicItems.length === 0}
            <EmptyView
              title="No academic records."
              description="Click 'Add Academic Record' above to add college and degree program entries."
            >
              {#snippet icon()}
                <GraduationCap class="h-8 w-8 text-muted-foreground/40" />
              {/snippet}
            </EmptyView>
          {:else}
            <div
              class="relative space-y-6 before:absolute before:top-2 before:left-2.75 before:h-[calc(100%-16px)] before:w-px before:bg-border"
            >
              {#each academicItems as item, i}
                <div class="relative flex items-start gap-4 pl-8">
                  <div
                    class="absolute left-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-background bg-muted shadow-sm ring-1 ring-border"
                  >
                    <AwardIcon class="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <div class="flex flex-1 items-start justify-between gap-4">
                    <div class="flex flex-col gap-0.5">
                      <span
                        class="text-xs font-bold tracking-widest text-primary uppercase opacity-80"
                      >
                        {translateCollege(item.college)[0] || item.college || "No College"}
                      </span>
                      <p class="text-sm leading-tight font-bold text-foreground">
                        {translateProgram(item.program)[0] || item.program || "No Program"}
                      </p>
                    </div>
                    <div class="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-7 w-7 text-muted-foreground hover:text-primary"
                        onclick={() => openEditDialog(i)}
                      >
                        <UserCog class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onclick={() => removeAcademicItem(i)}
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Right Column -->
    <div class="space-y-6">
      <Card.Root class="overflow-visible">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <IdCard class="h-5 w-5" />
            Account Information
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4 overflow-visible">
          <div class="space-y-2">
            <Label for="email" class="flex items-center gap-1.5">Email Address</Label>
            <Input id="email" type="email" bind:value={formData.email} />
          </div>

          <div class="space-y-2">
            <Label for="secondaryContact" class="flex items-center gap-1.5">
              Secondary Contact
            </Label>
            <Input
              id="secondaryContact"
              bind:value={formData.secondaryContact}
              placeholder="Phone or alternative email"
            />
          </div>

          <div class="space-y-2">
            <Label for="address" class="flex items-center gap-1.5">Permanent Address</Label>
            <Textarea
              id="address"
              bind:value={formData.address}
              placeholder="Complete home address"
              rows={2}
            />
          </div>

          <div class="space-y-2">
            <Label for="studentNo" class="flex items-center gap-1.5">Student Number</Label>
            <Input
              id="studentNo"
              bind:value={formData.studentNo}
              oninput={(e) => (formData.studentNo = maskStudentNoInput(e.currentTarget.value))}
              placeholder="XXXX-XXXXX"
              inputmode="numeric"
            />
          </div>

          <div class="space-y-2">
            <Label for="tags" class="flex items-center gap-1.5">Tags</Label>
            <TagsInput
              id="tags"
              bind:value={userTypes}
              suggestions={allUserTags}
              validate={validateTag}
              formatLabel={(tag) => USER_TAG_LABELS[tag] || tag}
              filterSuggestions={(input, suggestions) => {
                const lower = input.toLowerCase();
                return suggestions.filter((s) => {
                  const label = (USER_TAG_LABELS[s] || s).toLowerCase();
                  return s.toLowerCase().includes(lower) || label.includes(lower);
                });
              }}
              placeholder="Add tags…"
            />
            <p class="text-xs text-muted-foreground italic">Press enter to add custom tags.</p>
          </div>

          <div class="space-y-2 pt-2">
            <Label for="notes" class="flex items-center gap-1.5">Notes</Label>
            <Textarea
              id="notes"
              bind:value={formData.notes}
              rows={3}
              placeholder="Internal notes about this user…"
            />
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<!-- Academic Item Dialog -->
<Dialog.Root bind:open={isDialogOpen}>
  <Dialog.Content class="sm:max-w-106.25">
    <Dialog.Header>
      <Dialog.Title>{editingIndex !== null ? "Edit" : "Add"} Academic Record</Dialog.Title>
      <Dialog.Description>Configure college and degree program.</Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 pb-4">
      <div class="space-y-2">
        <Label>College</Label>
        <Combobox
          bind:value={editingItem.college}
          options={collegeOptions}
          placeholder="Select College…"
          searchPlaceholder="Search college…"
          class="w-full"
        />
      </div>
      <div class="space-y-2">
        <Label>Degree Program</Label>
        <Combobox
          bind:value={editingItem.program}
          options={programOptions}
          placeholder="Select Program…"
          searchPlaceholder="Search program…"
          disabled={editingItem.college === "NO DATA" || editingItem.college === "UHO"}
          class="w-full"
        />
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (isDialogOpen = false)}>Cancel</Button>
      <Button onclick={saveAcademicItem} icon={Save}>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
