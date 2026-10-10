<script lang="ts">
  import {
    Attachment,
    AttachmentMedia,
    AttachmentContent,
    AttachmentTitle,
    AttachmentDescription,
    AttachmentActions,
    AttachmentAction
  } from "$ui/attachment";
  import { Label } from "$ui/label";
  import * as InputGroup from "$ui/input-group";
  import { settings } from "$state/settings.svelte";
  import { compressImage, transformGoogleDriveLink } from "$utils/image-utils";
  import { toast } from "svelte-sonner";
  import { Upload, X } from "@lucide/svelte";

  interface Props {
    value?: string;
    file?: File | Blob | null;
    previewUrl?: string | null;
    allowUrl?: boolean;
    disabled?: boolean;
    label?: string;
    class?: string;
    onchange?: () => void;
  }

  let {
    value = $bindable(""),
    file = $bindable(null),
    previewUrl = $bindable(null),
    allowUrl = true,
    disabled = false,
    label,
    class: className = "",
    onchange
  }: Props = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  let isProcessing = $state(false);
  let fileName = $state<string>("");

  const effectivePreview = $derived(previewUrl || null);

  async function processFile(selectedFile: File) {
    isProcessing = true;
    try {
      const processed = await compressImage(selectedFile);
      file = processed;
      fileName = selectedFile.name;

      if (previewUrl && !value.startsWith("http")) {
        URL.revokeObjectURL(previewUrl);
      }
      const newPreview = URL.createObjectURL(processed);
      previewUrl = newPreview;
      value = "PENDING_UPLOAD";
      onchange?.();
    } catch (err: any) {
      toast.error("File processing failed: " + (err.message || "Unknown error"));
    } finally {
      isProcessing = false;
    }
  }

  async function handleFileInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const selected = target.files?.[0];
    if (selected) {
      await processFile(selected);
    }
    target.value = "";
  }

  function handleRemove() {
    if (previewUrl && !value.startsWith("http")) {
      URL.revokeObjectURL(previewUrl);
    }
    file = null;
    previewUrl = null;
    value = "";
    fileName = "";
    onchange?.();
  }

  function handleUrlInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    value = val;
    file = null;
    onchange?.();
  }

  function handleUrlCommit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "PENDING_UPLOAD") {
      return;
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      previewUrl = transformGoogleDriveLink(trimmed);
      fileName = "";
      onchange?.();
    }
  }
</script>

<div class="space-y-2 {className}">
  {#if label}
    <Label>{label}</Label>
  {/if}

  <input
    type="file"
    accept="image/*"
    capture="environment"
    class="hidden"
    bind:this={fileInput}
    onchange={handleFileInputChange}
    {disabled}
  />

  {#if effectivePreview}
    <div class="space-y-2">
      <Attachment
        state={isProcessing ? "processing" : "done"}
        class="w-full max-w-full flex-nowrap items-center justify-between overflow-hidden p-2"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <AttachmentMedia variant="image" class="size-14 shrink-0 rounded-md border">
            <img src={effectivePreview} alt="Preview" class="h-full w-full object-cover" />
          </AttachmentMedia>
          <AttachmentContent class="min-w-0 flex-1 overflow-hidden">
            <AttachmentTitle class="truncate text-sm font-medium">
              {fileName || (file ? "Attached Image" : (previewUrl ?? "Image Link"))}
            </AttachmentTitle>
            <AttachmentDescription class="truncate text-xs text-muted-foreground">
              {file ? "Ready to upload" : "Image URL"}
            </AttachmentDescription>
          </AttachmentContent>
        </div>
        <AttachmentActions class="ml-2 shrink-0">
          <AttachmentAction aria-label="Remove image" onclick={handleRemove} {disabled}>
            <X class="size-4" />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  {:else if allowUrl}
    <div class="space-y-2">
      <InputGroup.Root>
        <InputGroup.Input
          placeholder="Paste image or Google Drive link…"
          {value}
          oninput={handleUrlInput}
          onblur={handleUrlCommit}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleUrlCommit();
            }
          }}
          disabled={disabled || isProcessing}
        />
        {#if settings.firebaseEnabled}
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button
              aria-label="Upload image"
              title="Upload image"
              variant="secondary"
              disabled={disabled || isProcessing}
              onclick={() => fileInput?.click()}
            >
              <Upload class="size-3.5" />
              Upload
            </InputGroup.Button>
          </InputGroup.Addon>
        {/if}
      </InputGroup.Root>
      <p class="text-xs text-muted-foreground">
        If using a Google Drive link, make sure it's shared with 'Anyone with the link' permission.
      </p>
    </div>
  {:else}
    <!-- Direct upload only (e.g. Fridge items) -->
    <div
      role="button"
      tabindex="0"
      onclick={() => !disabled && !isProcessing && fileInput?.click()}
      onkeydown={(e) => {
        if (!disabled && !isProcessing && (e.key === "Enter" || e.key === " ")) {
          fileInput?.click();
        }
      }}
      class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted p-6 text-center transition-colors hover:border-border hover:bg-muted/30"
    >
      <Upload class="h-6 w-6 text-muted-foreground" />
      <div class="text-xs text-muted-foreground">
        <span class="font-medium text-foreground">Click to upload photo</span> or take picture
      </div>
    </div>
  {/if}
</div>
