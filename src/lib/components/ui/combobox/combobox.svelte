<script lang="ts">
  import { browser } from "$app/environment";
  import { buttonVariants } from "$ui/button/index.js";
  import * as Command from "$ui/command/index.js";
  import * as Drawer from "$ui/drawer/index.js";
  import * as Popover from "$ui/popover/index.js";
  import { onMount, tick } from "svelte";
  import { Check, ChevronsUpDown } from "@lucide/svelte";
  import { cn } from "$lib/utils.js";
  import type { ClassValue } from "clsx";

  type ComboboxOption = {
    value: string;
    label: string;
    disabled?: boolean;
    /** Short symbol rendered in a colored icon before the label. */
    badge?: string;
    /** Tailwind classes for the icon, e.g. green for "in", red for "out". */
    badgeClass?: string;
    /** Shown as muted helper text and as the item's tooltip. */
    description?: string;
    /** When set on any option, the list renders one heading per group. */
    group?: string;
    /** Extra text matched by the search box but not shown in the list. */
    searchText?: string;
  };

  let {
    value = $bindable(""),
    options = [],
    placeholder = "Select item...",
    searchPlaceholder = "Search item...",
    emptyMessage = "No item found.",
    disabled = false,
    class: className = "",
    onSelect
  }: {
    value: string;
    options: ComboboxOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    class?: string;
    onSelect?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let isDesktop = $state(false);
  let triggerRef = $state<HTMLButtonElement>(null!);

  function checkScreenSize() {
    isDesktop = window.innerWidth >= 768;
  }

  onMount(() => {
    if (browser) {
      checkScreenSize();
      window.addEventListener("resize", checkScreenSize);
      return () => window.removeEventListener("resize", checkScreenSize);
    }
  });

  const selectedOption = $derived(options.find((o) => o.value === value));
  const selectedLabel = $derived(selectedOption?.label || value);
  const selectedDescription = $derived(selectedOption?.description ?? "");

  function searchValue(opt: ComboboxOption): string {
    return `${opt.label} ${opt.value}${opt.searchText ? ` ${opt.searchText}` : ""}`;
  }

  const hasGroups = $derived(options.some((o) => o.group));

  /** One entry per group, in first-seen order, so categories keep their order. */
  const groupedOptions = $derived.by(() => {
    if (!hasGroups) {
      return null;
    }
    const groups: { value: string; heading: string; options: ComboboxOption[] }[] = [];
    for (const opt of options) {
      const heading = opt.group ?? "";
      const existing = groups.find((g) => g.heading === heading);
      if (existing) {
        existing.options.push(opt);
      } else {
        groups.push({ value: heading || `ungrouped-${groups.length}`, heading, options: [opt] });
      }
    }
    return groups;
  });

  function handleSelect(val: string) {
    value = val;
    open = false;
    onSelect?.(val);
    if (isDesktop) {
      tick().then(() => triggerRef?.focus());
    }
  }
</script>

{#snippet optionItem(opt: ComboboxOption, uncheckedClass: ClassValue)}
  <Check class={cn("mr-2 h-4 w-4 shrink-0", uncheckedClass)} />
  {#if opt.badge}
    <span
      class={cn(
        "mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs leading-none font-bold",
        opt.badgeClass
      )}>{opt.badge}</span
    >
  {/if}
  <span class="shrink-0 font-medium whitespace-nowrap">{opt.label}</span>
  {#if opt.description}
    <span class="ml-2 min-w-0 flex-1 truncate text-xs text-muted-foreground">{opt.description}</span
    >
  {/if}
{/snippet}

{#if isDesktop}
  <Popover.Root bind:open>
    <Popover.Trigger bind:ref={triggerRef} {disabled} class={cn("block w-full", className)}>
      {#snippet child({ props }: { props: Record<string, any> })}
        <button
          {...props}
          class={cn(
            buttonVariants({ variant: "outline" }),
            "flex w-full min-w-0 items-center gap-2 text-left font-normal",
            className
          )}
          role="combobox"
          aria-expanded={open}
          title={selectedDescription || undefined}
        >
          {#if selectedOption?.badge}
            <span
              class={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs leading-none font-bold",
                selectedOption.badgeClass
              )}>{selectedOption.badge}</span
            >
          {/if}
          <span class="min-w-0 flex-1 truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
        </button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
      <Command.Root>
        <Command.Input placeholder={searchPlaceholder} />
        <Command.List>
          <Command.Empty>{emptyMessage}</Command.Empty>
          {#if groupedOptions}
            {#each groupedOptions as grp (grp.value)}
              <Command.Group heading={grp.heading} value={grp.value}>
                {#each grp.options as opt (opt.value)}
                  <Command.Item
                    value={searchValue(opt)}
                    onSelect={() => handleSelect(opt.value)}
                    disabled={opt.disabled}
                    class={cn(opt.disabled && "opacity-50")}
                  >
                    {@render optionItem(opt, value !== opt.value && "opacity-0")}
                  </Command.Item>
                {/each}
              </Command.Group>
            {/each}
          {:else}
            <Command.Group>
              {#each options as opt (opt.value)}
                <Command.Item
                  value={searchValue(opt)}
                  onSelect={() => handleSelect(opt.value)}
                  disabled={opt.disabled}
                  class={cn(opt.disabled && "opacity-50")}
                  title={opt.description || undefined}
                >
                  {@render optionItem(opt, value !== opt.value && "opacity-0")}
                </Command.Item>
              {/each}
            </Command.Group>
          {/if}
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
{:else}
  <Drawer.Root bind:open>
    <Drawer.Trigger {disabled} class={cn("block w-full", className)}>
      {#snippet child({ props }: { props: Record<string, any> })}
        <button
          {...props}
          class={cn(
            buttonVariants({ variant: "outline" }),
            "flex w-full min-w-0 items-center gap-2 text-left font-normal",
            className
          )}
          title={selectedDescription || undefined}
        >
          {#if selectedOption?.badge}
            <span
              class={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs leading-none font-bold",
                selectedOption.badgeClass
              )}>{selectedOption.badge}</span
            >
          {/if}
          <span class="min-w-0 flex-1 truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
        </button>
      {/snippet}
    </Drawer.Trigger>
    <Drawer.Content>
      <div class="mt-4 border-t px-4 pb-8">
        <Command.Root>
          <Command.Input placeholder={searchPlaceholder} class="my-2" />
          <Command.List>
            <Command.Empty>{emptyMessage}</Command.Empty>
            {#if groupedOptions}
              {#each groupedOptions as grp (grp.value)}
                <Command.Group heading={grp.heading} value={grp.value}>
                  {#each grp.options as opt (opt.value)}
                    <Command.Item
                      value={searchValue(opt)}
                      onSelect={() => handleSelect(opt.value)}
                      disabled={opt.disabled}
                      class={cn(opt.disabled && "opacity-50")}
                      title={opt.description || undefined}
                    >
                      {@render optionItem(opt, value !== opt.value && "text-transparent")}
                    </Command.Item>
                  {/each}
                </Command.Group>
              {/each}
            {:else}
              <Command.Group>
                {#each options as opt (opt.value)}
                  <Command.Item
                    value={searchValue(opt)}
                    onSelect={() => handleSelect(opt.value)}
                    disabled={opt.disabled}
                    class={cn(opt.disabled && "opacity-50")}
                    title={opt.description || undefined}
                  >
                    {@render optionItem(opt, value !== opt.value && "text-transparent")}
                  </Command.Item>
                {/each}
              </Command.Group>
            {/if}
          </Command.List>
        </Command.Root>
      </div>
    </Drawer.Content>
  </Drawer.Root>
{/if}
