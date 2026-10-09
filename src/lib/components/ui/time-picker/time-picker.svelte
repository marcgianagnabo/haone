<script lang="ts">
  import { Input } from "$ui/input/index.js";
  import { Clock } from "@lucide/svelte";
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    value: string;
  }

  let { value = $bindable(), class: className, ...rest }: Props = $props();

  const id = Math.random().toString(36).substring(2, 9);
</script>

<div class={cn("relative", className)} {...rest}>
  <Input
    type="time"
    id="{id}-time"
    step="60"
    bind:value
    class="h-9 appearance-none rounded-md border-muted-foreground/20 bg-background px-3 pl-9 font-medium [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
  />
  <Clock
    class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
  />
</div>
