<script lang="ts">
  import { fetchConstantByKey, updateConstant } from "$api/controllers/constants-controller";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Label } from "$ui/label";
  import * as TimePicker from "$components/ui/time-picker";
  import { settings } from "$state/settings.svelte";
  import {
    DEFAULT_LAUNDRY_CLOSE,
    DEFAULT_LAUNDRY_OPEN,
    buildLaundrySlots,
    clearLaundryHoursCache,
    formatSlotMinutes
  } from "$utils/laundry-slots";
  import { parseTimeMinutes } from "$utils/parsers";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  let open = $state(DEFAULT_LAUNDRY_OPEN);
  let close = $state(DEFAULT_LAUNDRY_CLOSE);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let loadError = $state<string | null>(null);

  // Per-instance hours: stored in this hall's Supabase `constants` table
  // (LAUNDRY_OPEN / LAUNDRY_CLOSE). Readable by all residents of this
  // instance, writable by officers only (constants_write RLS).

  onMount(async () => {
    try {
      const [o, c] = await Promise.all([
        fetchConstantByKey("LAUNDRY_OPEN"),
        fetchConstantByKey("LAUNDRY_CLOSE")
      ]);
      if (o) open = o;
      if (c) close = c;
    } catch (e: any) {
      loadError = e?.message || "Could not load laundry hours";
    } finally {
      isLoading = false;
    }
  });

  const preview = $derived.by(() => {
    const openMin = parseTimeMinutes(open);
    const closeMin = parseTimeMinutes(close);
    if (isNaN(openMin) || isNaN(closeMin) || !(openMin < closeMin)) {
      return null;
    }
    return buildLaundrySlots(openMin, closeMin);
  });

  async function handleSave() {
    const openMin = parseTimeMinutes(open);
    const closeMin = parseTimeMinutes(close);
    if (isNaN(openMin) || isNaN(closeMin) || !(openMin < closeMin)) {
      toast.error("Opening time must be before closing time");
      return;
    }
    isSaving = true;
    try {
      // Upsert via update; insert the row first when the key is missing
      // (fresh instances only have the seeded defaults).
      const { addConstant } = await import("$api/controllers/constants-controller");
      for (const [key, value] of [
        ["LAUNDRY_OPEN", open],
        ["LAUNDRY_CLOSE", close]
      ] as const) {
        const existing = await fetchConstantByKey(key);
        if (existing === null) {
          await addConstant(key, value, `Laundry operating window (${key === "LAUNDRY_OPEN" ? "open" : "close"})`);
        } else {
          await updateConstant(key, value);
        }
      }
      clearLaundryHoursCache();
      toast.success("Laundry hours updated — slots regenerate automatically");
    } catch (e: any) {
      toast.error(e?.message || "Could not save laundry hours");
    } finally {
      isSaving = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Laundry Hours</Card.Title>
    <Card.Description>
      Operating window for this hall. Fixed 2-hour slots with 30-minute turnover
      buffers regenerate automatically when hours change. No partial slots are ever
      created — a leftover tail extends the effective close instead.
    </Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    {#if isLoading}
      <p class="text-sm text-muted-foreground">Loading laundry hours…</p>
    {:else if loadError}
      <p class="text-sm text-destructive">{loadError}</p>
    {:else}
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>Opens</Label>
          <TimePicker.Root bind:value={open} class="w-full" />
        </div>
        <div class="space-y-2">
          <Label>Closes</Label>
          <TimePicker.Root bind:value={close} class="w-full" />
        </div>
      </div>

      {#if preview}
        <div class="space-y-2">
          <Label class="text-sm">
            {preview.slots.length} fixed slots
            {#if preview.extended}
              <span class="font-semibold text-amber-600">
                (effective close {formatSlotMinutes(
                  preview.effectiveClose,
                  settings.clockFormat
                )} — extended to fit a full final slot)
              </span>
            {/if}
          </Label>
          <ul class="max-h-48 space-y-1 overflow-y-auto text-sm">
            {#each preview.slots as s}
              <li class="flex justify-between rounded-md bg-muted/40 px-3 py-1.5">
                <span class="font-medium">
                  {formatSlotMinutes(s.start, settings.clockFormat)} – {formatSlotMinutes(
                    s.end,
                    settings.clockFormat
                  )}
                </span>
                <span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  2 hrs
                </span>
              </li>
            {/each}
          </ul>
          <p class="text-xs text-muted-foreground">
            Changing hours can orphan existing bookings that no longer match the grid —
            review the laundry page for off-grid bookings after saving.
          </p>
        </div>
      {:else}
        <p class="text-sm text-destructive">Opening time must be before closing time.</p>
      {/if}

      <Button onclick={handleSave} isLoading={isSaving} disabled={!preview}>
        Save Hours
      </Button>
    {/if}
  </Card.Content>
</Card.Root>
