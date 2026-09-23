<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import { twMerge } from "tailwind-merge";
  let {
    class: className = "",
    variant = "warning",
    children
  }: {
    class?: string;
    variant?: "warning";
    children: Snippet;
  } = $props();
  let typeClasses = {
    warning: "border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400"
  };
</script>

<div class={twMerge("flex items-start gap-3 rounded-lg border", typeClasses[variant], className)}>
  <TriangleAlertIcon class="mt-0.5 h-5 w-5 shrink-0" />
  <div class="space-y-1 text-left font-medium">
    {@render children()}
  </div>
</div>
