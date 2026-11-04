<script lang="ts">
  import { onMount } from "svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { fetchServer } from "$utils/api-client";
  import { Image, Save, UploadCloud, X } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const endpoint = "/api/admin/public-portal/homepage";
  let fileInput = $state<HTMLInputElement>();
  let heading = $state("");
  let subheading = $state("");
  let selectedFile = $state<File | null>(null);
  let savedPreview = $state<string | null>(null);
  let localPreview = $state<string | null>(null);
  let removeImage = $state(false);
  let dragActive = $state(false);
  let configured = $state<boolean | null>(null);
  let maxImageBytes = $state(5 * 1024 * 1024);
  let loading = $state(true);
  let saving = $state(false);
  let optimizing = $state(false);

  const maxSourceBytes = 30 * 1024 * 1024;
  const targetImageBytes = 700 * 1024;

  const preview = $derived(localPreview || (removeImage ? null : savedPreview));

  $effect(() => {
    const url = selectedFile ? URL.createObjectURL(selectedFile) : null;
    localPreview = url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  }

  async function optimizeImage(file: File) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / bitmap.width, 1440 / bitmap.height);
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    let quality = 0.9;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not optimize this image");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await canvasBlob(canvas, quality);
      if (blob && blob.size <= targetImageBytes) break;
      if (quality > 0.5) quality -= 0.08;
      else {
        width = Math.max(1, Math.round(width * 0.88));
        height = Math.max(1, Math.round(height * 0.88));
      }
    }
    bitmap.close();
    if (!blob || blob.size > maxImageBytes) {
      throw new Error("The image could not be reduced to a safe upload size");
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "portal-hero";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  }

  async function selectImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > maxSourceBytes) {
      toast.error("Source image must be 30 MB or smaller.");
      return;
    }
    optimizing = true;
    try {
      selectedFile = await optimizeImage(file);
      removeImage = false;
      toast.success(`Image optimized to ${Math.ceil(selectedFile.size / 1024)} KB.`);
    } catch (error: any) {
      toast.error(error?.message || "Could not optimize the selected image.");
    } finally {
      optimizing = false;
    }
  }

  async function load() {
    loading = true;
    try {
      const result = await fetchServer<any>(endpoint, {}, true);
      configured = result.configured;
      maxImageBytes = result.maxImageBytes;
      heading = result.content?.hero_heading || "";
      subheading = result.content?.hero_subheading || "";
      savedPreview = result.heroPreviewDataUri || null;
    } catch (error: any) {
      toast.error(error?.message || "Could not load homepage content.");
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      const form = new FormData();
      form.set("heading", heading);
      form.set("subheading", subheading);
      form.set("removeImage", String(removeImage));
      if (selectedFile) form.set("image", selectedFile);
      const result = await fetchServer<any>(endpoint, {
        method: "PATCH",
        body: form
      });
      heading = result.content.hero_heading;
      subheading = result.content.hero_subheading;
      savedPreview = result.heroPreviewDataUri || null;
      selectedFile = null;
      removeImage = false;
      toast.success("Portal homepage updated.");
    } catch (error: any) {
      toast.error(error?.message || "Could not update homepage content.");
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    pageState.title = "Portal Homepage";
    load();
  });
</script>

<div class="mx-auto max-w-6xl space-y-6">
  <ContentHeader
    title="Homepage"
    subtitle="Manage the public portal hero content and image."
    href="/admin/portal"
  />

  {#if loading}
    <Card.Root
      ><Card.Content class="p-6 text-sm text-muted-foreground">Loading homepage…</Card.Content
      ></Card.Root
    >
  {:else if configured === false}
    <Card.Root
      ><Card.Content class="p-6 text-sm text-muted-foreground"
        >Portal homepage storage is not configured.</Card.Content
      ></Card.Root
    >
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>Hero content</Card.Title>
        <Card.Description
          >This content appears at the top of the NFRH Portal homepage.</Card.Description
        >
      </Card.Header>
      <Card.Content class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="hero-heading">Heading</Label>
            <Input id="hero-heading" bind:value={heading} maxlength={200} />
          </div>
          <div class="space-y-2">
            <Label for="hero-subheading">Subheading</Label>
            <Textarea id="hero-subheading" bind:value={subheading} maxlength={600} rows={6} />
          </div>
          <div class="flex justify-end">
            <Button onclick={save} isLoading={saving} disabled={optimizing} icon={Save}
              >Save Homepage</Button
            >
          </div>
        </div>

        <div class="space-y-3">
          <Label>Hero image</Label>
          <input
            bind:this={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            disabled={optimizing || saving}
            onchange={(event) => selectImage(event.currentTarget.files?.[0])}
          />
          <div
            role="button"
            tabindex="0"
            aria-label="Upload portal hero image"
            class="relative flex min-h-72 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed {dragActive
              ? 'border-brand bg-brand/5'
              : 'border-border bg-muted/10'}"
            aria-disabled={optimizing || saving}
            onclick={() => {
              if (!optimizing && !saving) fileInput?.click();
            }}
            onkeydown={(event) => {
              if (!optimizing && !saving && (event.key === "Enter" || event.key === " "))
                fileInput?.click();
            }}
            ondragover={(event) => {
              event.preventDefault();
              dragActive = true;
            }}
            ondragleave={() => (dragActive = false)}
            ondrop={(event) => {
              event.preventDefault();
              dragActive = false;
              if (!optimizing && !saving) selectImage(event.dataTransfer?.files?.[0]);
            }}
          >
            {#if preview}
              <img
                src={preview}
                alt="Portal hero preview"
                class="absolute inset-0 size-full object-cover"
              />
              <div class="absolute inset-0 bg-black/30"></div>
              <span class="relative rounded-md bg-background/90 px-3 py-2 text-sm font-medium"
                >{optimizing ? "Optimizing…" : "Replace image"}</span
              >
            {:else}
              <div class="flex flex-col items-center gap-3 p-6 text-center">
                <UploadCloud class="size-8 text-brand" />
                <div>
                  <p class="text-sm font-medium">
                    {optimizing
                      ? "Optimizing high-resolution image…"
                      : "Drop an image or click to browse"}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    JPEG, PNG, or WebP · source up to 30 MB · optimized below 700 KB
                  </p>
                </div>
              </div>
            {/if}
          </div>
          {#if preview}
            <Button
              variant="outline"
              size="sm"
              icon={X}
              onclick={() => {
                selectedFile = null;
                removeImage = true;
                if (fileInput) fileInput.value = "";
              }}>Use Default Background</Button
            >
          {:else}
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Image class="size-4" /> The portal default image is used when no custom image is saved.
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>
