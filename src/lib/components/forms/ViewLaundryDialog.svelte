<script lang="ts">
  import { TrashIcon, CalendarPlusIcon, Share2Icon } from "@lucide/svelte";
  import { Button } from "$components/ui/button";
  import { checkIsPast, generateIcsFile, getGoogleCalendarUrl } from "$utils/calendar";
  import { brandingState } from "$state/branding.svelte";
  import { ResponsiveDialog } from "$ui/haone";
  import { formatTimeRange, formatDate } from "$utils/formatters";
  import { settings } from "$state/settings.svelte";

  let {
    isAdminView = false,
    currentUserId = "",
    onCancelReservation
  }: {
    isAdminView?: boolean;
    currentUserId?: string;
    onCancelReservation?: (id: string) => void;
  } = $props();

  let isDialogOpen = $state(false);
  let selectedReservation: any = $state(null);

  let isDetailPast = $derived(
    selectedReservation ? checkIsPast(selectedReservation.date, selectedReservation.timeEnd) : false
  );

  function close() {
    isDialogOpen = false;
  }

  export function open(reservation: any) {
    selectedReservation = reservation;
    isDialogOpen = true;
  }
</script>

<ResponsiveDialog.Root bind:open={isDialogOpen}>
  <ResponsiveDialog.Content class="sm:max-w-xl">
    {@const isMine = currentUserId && selectedReservation.residentId === currentUserId}
    {@const showActions = isMine || isAdminView}

    <ResponsiveDialog.Header>
      <ResponsiveDialog.Title>Reservation Details</ResponsiveDialog.Title>
    </ResponsiveDialog.Header>

    <div class="space-y-3 px-4 md:px-0">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <p class="font-medium">Reserved By</p>
          <p>{selectedReservation.name}</p>
          {#if selectedReservation.room}
            <p class="text-xs">Room {selectedReservation.room}</p>
          {/if}
        </div>

        {#if selectedReservation.creationTimestamp}
          <div class="space-y-1">
            <p class="font-medium">Reserved on</p>
            <p>{new Date(selectedReservation.creationTimestamp).toLocaleString()}</p>
          </div>
        {/if}

        <div class="space-y-1">
          <p class="font-medium">Date</p>
          <p>{formatDate(selectedReservation.date)}</p>
        </div>

        <div class="space-y-1">
          <p class="font-medium">Time</p>
          <p>
            {formatTimeRange(selectedReservation.timeStart, settings.clockFormat)}–{formatTimeRange(
              selectedReservation.timeEnd,
              settings.clockFormat
            )}
          </p>
        </div>
      </div>

      {#if showActions}
        <div class="space-y-2 pt-2">
          <div class="grid gap-2 md:grid-cols-2">
            <Button
              variant="secondary"
              size="sm"
              onclick={() => generateIcsFile(selectedReservation, brandingState.profile.shortName)}
              icon={CalendarPlusIcon}
            >
              <span class="truncate">Download .ics</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              href={getGoogleCalendarUrl(selectedReservation, brandingState.profile.shortName)}
              target="_blank"
              icon={Share2Icon}
            >
              <span class="truncate">Google Calendar</span>
            </Button>
          </div>
        </div>
      {/if}
    </div>

    <ResponsiveDialog.Footer class={showActions ? "grid grid-cols-2 gap-2 md:flex" : ""}>
      <ResponsiveDialog.Close>
        <Button variant={showActions ? "outline" : "default"} class="w-full">Close</Button>
      </ResponsiveDialog.Close>
      {#if showActions}
        <Button
          disabled={isDetailPast}
          onclick={() => {
            close();
            onCancelReservation?.(selectedReservation.id);
          }}
          icon={TrashIcon}
        >
          Cancel
        </Button>
      {/if}
    </ResponsiveDialog.Footer>
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
