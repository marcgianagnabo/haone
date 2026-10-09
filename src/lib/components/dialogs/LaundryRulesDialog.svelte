<script lang="ts">
  import { ResponsiveDialog } from "$ui/haone";
  import { Button } from "$ui/button";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import { getLaundryGrid, formatSlotMinutes, type LaundryGrid } from "$utils/laundry-slots";
  import { browser } from "$app/environment";

  let isDialogOpen = $state(false);
  let grid = $state<LaundryGrid | null>(null);
  let wasOpened = false;

  export const LAUNDRY_RULES_SEEN_KEY = "laundry-rules-seen-v1";

  export function open() {
    wasOpened = true;
    if (!grid) {
      void getLaundryGrid()
        .then((g) => {
          grid = g;
        })
        .catch(() => {});
    }
    isDialogOpen = true;
  }

  export function close() {
    isDialogOpen = false;
  }

  // Hall-specific prose from branding, minus the lines now generated above
  // (operating hours / 2-hour cap) so they are never duplicated.
  const extraBrandingRules = $derived(
    (brandingState.profile.laundryRules || []).filter((rule: string) => {
      const r = rule.trim().toLowerCase();
      return !r.startsWith("operating hours") && !r.startsWith("maximum of two (2) hours");
    })
  );

  // Remember dismissal so the rules auto-popup only shows once.
  $effect(() => {
    if (!isDialogOpen && wasOpened && browser) {
      try {
        localStorage.setItem(LAUNDRY_RULES_SEEN_KEY, "1");
      } catch {}
    }
  });
</script>

<ResponsiveDialog.Root bind:open={isDialogOpen}>
  <ResponsiveDialog.Content class="sm:max-w-lg">
    <ResponsiveDialog.Header>
      <ResponsiveDialog.Title>Laundry Rules & Guidelines</ResponsiveDialog.Title>
    </ResponsiveDialog.Header>

    <div class="space-y-4 px-4 md:px-0">
      <ul class="list-inside list-disc space-y-2">
        {#if grid}
          <li>
            Operating Hours: {formatSlotMinutes(grid.open, settings.clockFormat)} –
            {formatSlotMinutes(grid.effectiveClose, settings.clockFormat)}
            {#if grid.extended}
              (extended from {formatSlotMinutes(grid.close, settings.clockFormat)} to fit full 2-hour
              slots — no partial slots)
            {/if}.
          </li>
        {:else}
          <li>Operating Hours: 5:00 AM – 10:30 PM.</li>
        {/if}
        <li>Maximum of two (2) hours per day.</li>
      </ul>

      {#if extraBrandingRules.length > 0}
        <ul class="list-inside list-disc space-y-2">
          {#each extraBrandingRules as rule}
            <li>{rule}</li>
          {/each}
        </ul>
      {:else if (brandingState.profile.laundryRules || []).length === 0}
        <p>Your association has not set any specific laundry rules yet.</p>
      {/if}
    </div>

    <ResponsiveDialog.Footer>
      <ResponsiveDialog.Close>
        <Button class="w-full sm:w-auto">Close</Button>
      </ResponsiveDialog.Close>
    </ResponsiveDialog.Footer>
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
