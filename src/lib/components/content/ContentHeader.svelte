<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import BackButton from "./BackButton.svelte";
  import { Button, type ButtonProps } from "$ui/button";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import { RefreshCcw, EllipsisVerticalIcon, ChevronDown, Funnel } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { pageState, filterState } from "$state/page-info.svelte";

  import type { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { ButtonGroup } from "$components/ui/button-group";

  export type HeaderActionItem = DropdownMenuPrimitive.ItemProps & {
    label?: string;
    icon?: any;
    href?: string;
    variant?: "default" | "destructive";
  };

  export type HeaderAction = ButtonProps & {
    label?: string;
    items?: HeaderActionItem[];
  };

  let {
    title = "",
    subtitle = "",
    href = "",
    onBack = undefined,
    onRefresh = undefined,
    isRefreshing = false,
    actions = [],
    tabs = undefined,
    titleExtra = undefined,
    isTopLevel = false,
    hasFilter = false
  }: {
    title: string;
    subtitle?: string;
    href?: string;
    onBack?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    actions?: HeaderAction[];
    tabs?: Snippet;
    titleExtra?: Snippet;
    isTopLevel?: boolean;
    hasFilter?: boolean;
  } = $props();

  onMount(() => {
    pageState.isTopLevel = isTopLevel;
  });

  // This check is a mouthful due to nested dropdowns. Simply put, if there are
  // 1 or 2 actions with no refresh and none of them have sub-items, display
  // them directly. Otherwise, show a dropdown menu.
  const oneStandaloneAction = $derived(
    actions.length === 1 && (!actions[0].items || actions[0].items.length === 0)
  );
  const twoStandaloneActions = $derived(
    actions.length === 2 &&
      (!actions[0].items || actions[0].items.length === 0) &&
      (!actions[1].items || actions[1].items.length === 0)
  );
  const collapseToDropdown = $derived(
    oneStandaloneAction ||
      (twoStandaloneActions && ((!onRefresh && hasFilter) || (onRefresh && !hasFilter)))
  );
</script>

{#snippet filterTrigger()}
  {#if hasFilter}
    <div class="relative inline-flex">
      <Button
        variant="ghost"
        size="icon"
        icon={Funnel}
        iconClass="size-6"
        disabled={isRefreshing}
        onclick={() => {
          filterState.open = true;
        }}
      />
      {#if filterState.activeCount > 0}
        <span
          class="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
        >
          {filterState.activeCount}
        </span>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet mobileActions()}
  {#if collapseToDropdown}
    {#each actions as action}
      {@const { label, children, items: _items, icon: ActionIcon, disabled, ...rest } = action}
      <Button
        variant="ghost"
        size="icon"
        icon={ActionIcon}
        iconClass="size-6"
        disabled={isRefreshing || disabled}
        {...rest}
      >
        {#if !ActionIcon}
          {#if label}
            {label}
          {:else if children}
            {@render children()}
          {/if}
        {/if}
      </Button>
    {/each}
  {:else if actions.length > 0}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon"
            disabled={isRefreshing}
            icon={EllipsisVerticalIcon}
            iconClass="size-6"
          />
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-56">
        {#each actions as action, i}
          {@const ActionIcon = action.icon}
          {#if action.items && action.items.length > 0}
            <DropdownMenu.Group>
              <DropdownMenu.Label>
                {#if action.label}
                  {action.label}
                {:else if action.children}
                  {@render action.children()}
                {/if}
              </DropdownMenu.Label>
              <DropdownMenu.Separator />
              {#each action.items as item}
                {@const {
                  label,
                  icon: ItemIcon,
                  href,
                  onclick,
                  variant,
                  disabled,
                  ...restItem
                } = item}
                <DropdownMenu.Item
                  {...restItem}
                  disabled={isRefreshing || disabled}
                  variant={variant === "destructive" ? "destructive" : "default"}
                  onclick={(e) => {
                    if (isRefreshing || disabled) {
                      return;
                    }
                    if (href) {
                      goto(href);
                    }
                    if (onclick) {
                      onclick(e as any);
                    }
                  }}
                >
                  {#if ItemIcon}
                    <ItemIcon class="mr-2 h-4 w-4" />
                  {/if}
                  {#if label}
                    <span>{label}</span>
                  {/if}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Group>
            {#if i < actions.length - 1}
              <DropdownMenu.Separator />
            {/if}
          {:else}
            <DropdownMenu.Item
              disabled={isRefreshing || action.disabled || action.isLoading}
              variant={action.variant === "destructive" ? "destructive" : "default"}
              onclick={(e) => {
                if (isRefreshing || action.disabled || action.isLoading) {
                  return;
                }
                if (action.href) {
                  goto(action.href);
                }
                if (action.onclick) {
                  action.onclick(e as any);
                }
              }}
            >
              {#if ActionIcon}
                <ActionIcon class="mr-2 h-4 w-4" />
              {/if}
              {#if action.label}
                <span>{action.label}</span>
              {:else if action.children}
                <span>{@render action.children()}</span>
              {/if}
            </DropdownMenu.Item>
            {#if i < actions.length - 1 && actions[i + 1].items && actions[i + 1].items!.length > 0}
              <DropdownMenu.Separator />
            {/if}
          {/if}
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
{/snippet}

{#snippet desktopActions()}
  {#each actions as action}
    {#if action.items && action.items.length > 0}
      {@const { label, children, items, disabled, ...rest } = action}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button size="sm" disabled={isRefreshing || disabled} {...rest} {...props}>
              {#if label}
                {label}
              {:else if children}
                {@render children()}
              {/if}
              <ChevronDown class="ml-1.5 h-3 w-3 opacity-50" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {#each items as item}
            {@const {
              label,
              icon: ItemIcon,
              href,
              onclick,
              variant,
              disabled: itemDisabled,
              ...restItem
            } = item}
            <DropdownMenu.Item
              {...restItem}
              disabled={isRefreshing || itemDisabled}
              variant={variant === "destructive" ? "destructive" : "default"}
              onclick={(e) => {
                if (isRefreshing || itemDisabled) {
                  return;
                }
                if (href) {
                  goto(href);
                }
                if (onclick) {
                  onclick(e as any);
                }
              }}
            >
              {#if ItemIcon}
                <ItemIcon class="mr-2 h-4 w-4" />
              {/if}
              {#if label}
                <span>{label}</span>
              {/if}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {:else}
      {@const { label, children, items: _items, disabled, ...rest } = action}
      <Button size="sm" disabled={isRefreshing || disabled} {...rest}>
        {#if label}
          {label}
        {:else if children}
          {@render children()}
        {/if}
      </Button>
    {/if}
  {/each}
{/snippet}

<header
  class="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex flex-col gap-3 bg-background px-4 pt-4 pb-3 sm:static sm:z-auto sm:mx-0 sm:mt-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 md:gap-2"
>
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      {#if !isTopLevel}
        <BackButton {href} onclick={onBack} />
      {/if}
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {#if onRefresh}
            <Button
              variant="ghost"
              size="icon"
              class="hidden h-8 w-8 text-muted-foreground hover:text-foreground sm:inline-flex"
              onclick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCcw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
              <span class="sr-only">Refresh</span>
            </Button>
          {/if}
          {#if titleExtra}
            {@render titleExtra()}
          {/if}
        </div>
        {#if subtitle}
          <p class="text-sm text-muted-foreground">{subtitle}</p>
        {/if}
      </div>
    </div>

    {#if actions.length > 0 || onRefresh || hasFilter}
      <div class="flex items-center gap-1 sm:hidden">
        {#if onRefresh}
          <Button
            variant="ghost"
            size="icon"
            onclick={onRefresh}
            disabled={isRefreshing}
            icon={RefreshCcw}
            iconClass="size-6 {isRefreshing ? 'animate-spin' : ''}"
          />
        {/if}

        {@render filterTrigger()}
        {@render mobileActions()}
      </div>
    {/if}
  </div>

  <!-- Container for desktop display of action buttons and legacy actions -->
  {#if actions.length > 0 || tabs}
    <div
      class="flex items-center gap-3 {tabs
        ? 'w-full **:data-[slot=tabs]:w-full **:data-[slot=tabs-list]:w-full sm:w-auto sm:**:data-[slot=tabs]:w-auto sm:**:data-[slot=tabs-list]:w-auto'
        : 'hidden sm:flex'}"
    >
      {#if tabs}
        {@render tabs()}
      {/if}

      {#if actions.length > 0}
        <!-- Desktop Buttons -->
        <div class="hidden sm:flex sm:items-center sm:gap-2">
          <ButtonGroup>
            {@render desktopActions()}
          </ButtonGroup>
        </div>
      {/if}
    </div>
  {/if}
</header>
