<script lang="ts">
  import { ResponsiveDialog } from "$ui/haone";
  import { Button } from "$ui/button";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import {
    getLaundryGrid,
    formatSlotMinutes,
    isTwoWeekWindow,
    getBookingWindowStart,
    BOOKING_FLOOR,
    type LaundryGrid
  } from "$utils/laundry-slots";
  import { browser } from "$app/environment";

  // True only before the Oct 19 floor — once that floor is reached the
  // current-week bound takes over and the promo copy no longer applies.
  const isBeforeBookingFloor = $derived.by(() => {
    const [fy, fm, fd] = BOOKING_FLOOR.split("-").map(Number);
    const floor = new Date(fy, fm - 1, fd).getTime();
    return getBookingWindowStart().getTime() < floor;
  });

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
        <li>
          One active booking at a time — finish or cancel your current booking before booking
          another day.
        </li>
        <!-- PROMO-REMOVE-AFTER-2026-10-25: two-week advance booking window
             (Oct 12-25, 2026). Delete this bullet after the window ends.
             Only advertise it before the Oct 19 floor; on and after Oct 19 that
             week becomes the normal current-week window. -->
        {#if isTwoWeekWindow() && isBeforeBookingFloor}
          <li class="font-bold">October 19 - 25, 2026 is now available for advance booking!</li>
        {:else if isTwoWeekWindow()}
          <li class="font-bold">Bookings for October 12 - 18 are closed.</li>
        {/if}
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
