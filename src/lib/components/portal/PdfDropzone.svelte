<script lang="ts">
  import { Button } from "$ui/button";
  import { FileText, UploadCloud, X } from "@lucide/svelte";

  let {
    file = $bindable<File | null>(null),
    maxBytes,
    disabled = false,
    onError = () => undefined
  }: {
    file?: File | null;
    maxBytes: number;
    disabled?: boolean;
    onError?: (message: string) => void;
  } = $props();

  let input: HTMLInputElement;
  let dragActive = $state(false);

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function select(candidate?: File) {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      onError("Only PDF documents can be uploaded.");
      return;
    }
    if (candidate.size > maxBytes) {
      onError(`PDF must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`);
      return;
    }
    file = candidate;
  }

  function openPicker() {
    if (!disabled) input.click();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }
</script>

<input
  bind:this={input}
  type="file"
  accept="application/pdf,.pdf"
  class="sr-only"
  {disabled}
  onchange={(event) => select(event.currentTarget.files?.[0])}
/>

{#if file}
  <div class="flex items-center gap-3 rounded-xl border bg-muted/20 p-4">
    <div class="rounded-lg bg-brand/10 p-2 text-brand"><FileText class="size-5" /></div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">{file.name}</p>
      <p class="text-xs text-muted-foreground">{formatBytes(file.size)} · PDF document</p>
    </div>
    <Button variant="outline" size="sm" onclick={openPicker} {disabled}>Replace</Button>
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={() => {
        file = null;
        input.value = "";
      }}
      {disabled}
      icon={X}
    />
  </div>
{:else}
  <div
    role="button"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled}
    class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors {dragActive
      ? 'border-brand bg-brand/5'
      : 'border-border bg-muted/10 hover:bg-muted/20'} {disabled
      ? 'pointer-events-none opacity-50'
      : 'cursor-pointer'}"
    onclick={openPicker}
    onkeydown={handleKeydown}
    ondragenter={(event) => {
      event.preventDefault();
      dragActive = true;
    }}
    ondragover={(event) => {
      event.preventDefault();
      dragActive = true;
    }}
    ondragleave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) dragActive = false;
    }}
    ondrop={(event) => {
      event.preventDefault();
      dragActive = false;
      select(event.dataTransfer?.files?.[0]);
    }}
  >
    <div class="rounded-xl bg-brand/10 p-3 text-brand"><UploadCloud class="size-6" /></div>
    <div>
      <p class="text-sm font-medium">Drop a PDF here or click to browse</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Maximum file size: {Math.floor(maxBytes / 1024 / 1024)} MB
      </p>
    </div>
  </div>
{/if}
