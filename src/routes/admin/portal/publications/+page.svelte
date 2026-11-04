<script lang="ts">
  import { onMount } from "svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import PdfDropzone from "$components/portal/PdfDropzone.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { Badge } from "$ui/badge";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import * as Table from "$ui/table";
  import { Textarea } from "$ui/textarea";
  import { fetchServer } from "$utils/api-client";
  import {
    Archive,
    ExternalLink,
    Eye,
    FileText,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    X
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  type Status = "draft" | "published" | "archived";
  type Publication = {
    id: string;
    slug: string;
    title: string;
    memo_number: string;
    document_type: string;
    description: string;
    published_at: string;
    drive_file_id: string;
    drive_view_url: string;
    drive_download_url: string;
    preview_image_id: string;
    status: Status;
    is_featured: boolean;
    created_at: string;
    updated_at: string;
  };

  const endpoint = "/api/admin/public-portal/publications";
  const emptyForm = () => ({
    title: "",
    memoNumber: "",
    documentType: "Memorandum",
    description: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    status: "draft" as Status,
    isFeatured: false
  });

  let publications = $state<Publication[]>([]);
  let configured = $state<boolean | null>(null);
  let previewConfigured = $state(false);
  let maxPdfBytes = $state(20 * 1024 * 1024);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state<string | null>(null);
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let form = $state(emptyForm());
  let selectedFile = $state<File | null>(null);
  let localPreviewUrl = $state<string | null>(null);
  let search = $state("");
  let statusFilter = $state<"all" | Status>("all");
  let dateSort = $state<"desc" | "asc">("desc");
  let busyId = $state<string | null>(null);

  const filtered = $derived(
    publications
      .filter((publication) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          publication.title.toLowerCase().includes(query) ||
          publication.memo_number.toLowerCase().includes(query) ||
          publication.document_type.toLowerCase().includes(query);
        return matchesSearch && (statusFilter === "all" || publication.status === statusFilter);
      })
      .sort((a, b) => {
        const difference = a.published_at.localeCompare(b.published_at);
        return dateSort === "asc" ? difference : -difference;
      })
  );

  $effect(() => {
    const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
    localPreviewUrl = previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  });

  function statusClass(status: Status) {
    if (status === "published") {
      return "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300";
    }
    if (status === "archived") {
      return "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300";
    }
    return "border-border bg-muted text-muted-foreground";
  }

  async function loadPublications() {
    isLoading = true;
    error = null;
    try {
      const result = await fetchServer<{
        configured: boolean;
        previewConfigured: boolean;
        maxPdfBytes: number;
        publications: Publication[];
      }>(endpoint, {}, true);
      configured = result.configured;
      previewConfigured = result.previewConfigured;
      maxPdfBytes = result.maxPdfBytes;
      publications = result.publications;
    } catch (loadError: any) {
      error = loadError?.message || "Could not load publications.";
    } finally {
      isLoading = false;
    }
  }

  function resetForm() {
    editingId = null;
    form = emptyForm();
    selectedFile = null;
    formOpen = false;
  }

  function openCreate() {
    editingId = null;
    form = emptyForm();
    selectedFile = null;
    formOpen = true;
  }

  function openEdit(publication: Publication) {
    editingId = publication.id;
    selectedFile = null;
    form = {
      title: publication.title,
      memoNumber: publication.memo_number,
      documentType: publication.document_type || "Other",
      description: publication.description,
      publishedAt: publication.published_at,
      status: publication.status,
      isFeatured: publication.is_featured
    };
    formOpen = true;
  }

  async function savePublication() {
    if (!editingId && !selectedFile) {
      toast.error("Select a PDF document.");
      return;
    }
    isSaving = true;
    try {
      if (editingId) {
        const result = await fetchServer<{ publication: Publication }>(`${endpoint}/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        publications = publications.map((item) =>
          item.id === editingId ? result.publication : item
        );
        toast.success("Publication updated.");
      } else {
        const data = new FormData();
        data.set("file", selectedFile!);
        Object.entries(form).forEach(([key, value]) => data.set(key, String(value)));
        const result = await fetchServer<{
          publication: Publication;
          warnings: string[];
        }>(endpoint, { method: "POST", body: data });
        publications = [result.publication, ...publications];
        toast.success("Publication uploaded.");
        result.warnings.forEach((warning) => toast.warning(warning));
      }
      resetForm();
      await loadPublications();
    } catch (saveError: any) {
      toast.error(saveError?.message || "Could not save publication.");
    } finally {
      isSaving = false;
    }
  }

  async function patchPublication(publication: Publication, changes: Partial<typeof form>) {
    busyId = publication.id;
    try {
      const payload = {
        title: publication.title,
        memoNumber: publication.memo_number,
        documentType: publication.document_type,
        description: publication.description,
        publishedAt: publication.published_at,
        status: publication.status,
        isFeatured: publication.is_featured,
        ...changes
      };
      const result = await fetchServer<{ publication: Publication }>(
        `${endpoint}/${publication.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      publications = publications.map((item) => {
        if (item.id === publication.id) return result.publication;
        return result.publication.is_featured ? { ...item, is_featured: false } : item;
      });
      toast.success("Publication updated.");
    } catch (actionError: any) {
      toast.error(actionError?.message || "Could not update publication.");
    } finally {
      busyId = null;
    }
  }

  async function regeneratePreview(publication: Publication) {
    busyId = publication.id;
    try {
      await fetchServer(`${endpoint}/${publication.id}/preview`, { method: "POST" });
      toast.success("Publication preview regenerated.");
      await loadPublications();
    } catch (previewError: any) {
      toast.error(previewError?.message || "Could not regenerate preview.");
    } finally {
      busyId = null;
    }
  }

  function confirmDelete(publication: Publication) {
    globalDialog.confirm(
      "Permanently delete publication?",
      `“${publication.title}” will be removed from the portal, Shared Drive, and preview storage. This cannot be undone.`,
      undefined,
      async () => {
        try {
          const result = await fetchServer<{ success: boolean; warnings: string[] }>(
            `${endpoint}/${publication.id}`,
            { method: "DELETE" }
          );
          publications = publications.filter((item) => item.id !== publication.id);
          if (result.warnings.length) {
            result.warnings.forEach((warning) => toast.warning(warning));
          } else {
            toast.success("Publication permanently deleted.");
          }
        } catch (deleteError: any) {
          toast.error(deleteError?.message || "Could not delete publication.");
        }
      },
      undefined,
      { accept: "Delete permanently", cancel: "Cancel" }
    );
  }

  onMount(() => {
    pageState.title = "Portal Publications";
    loadPublications();
  });
</script>

<div class="mx-auto max-w-7xl space-y-6">
  <ContentHeader
    title="Publications"
    subtitle="Manage documents published on the NFRH public portal."
    href="/admin/portal"
    actions={[{ label: "Add Publication", icon: Plus, onclick: openCreate }]}
  />

  {#if formOpen}
    <Card.Root>
      <Card.Header>
        <div class="flex items-start justify-between gap-3">
          <div>
            <Card.Title>{editingId ? "Edit publication" : "New publication"}</Card.Title>
            <Card.Description>
              {editingId
                ? "Update the public metadata and publication state."
                : "Upload a PDF and provide its public information."}
            </Card.Description>
          </div>
          <Button variant="ghost" size="icon-sm" onclick={resetForm} icon={X} />
        </div>
      </Card.Header>
      <Card.Content class="space-y-5">
        <div class="grid gap-5 lg:grid-cols-2">
          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="publication-title">Title</Label>
              <Input id="publication-title" bind:value={form.title} maxlength={200} />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="publication-number">Memo/reference number</Label>
                <Input id="publication-number" bind:value={form.memoNumber} maxlength={100} />
              </div>
              <div class="space-y-2">
                <Label for="publication-type">Document type</Label>
                <Input id="publication-type" bind:value={form.documentType} maxlength={80} />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="publication-description">Brief description</Label>
              <Textarea
                id="publication-description"
                bind:value={form.description}
                maxlength={4000}
                rows={5}
              />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="publication-date">Publication date</Label>
                <Input id="publication-date" type="date" bind:value={form.publishedAt} />
              </div>
              <div class="space-y-2">
                <Label for="publication-status">Status</Label>
                <select
                  id="publication-status"
                  bind:value={form.status}
                  class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onchange={() => {
                    if (form.status !== "published") form.isFeatured = false;
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <label class="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                bind:checked={form.isFeatured}
                disabled={form.status !== "published"}
                class="size-4 rounded border-input accent-brand"
              />
              Feature this publication on the portal homepage
            </label>
          </div>

          <div class="space-y-3">
            {#if editingId}
              <div
                class="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 p-6 text-center"
              >
                <FileText class="mb-3 size-8 text-muted-foreground" />
                <p class="text-sm font-medium">The existing PDF will be retained</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Create a new publication to upload a different document.
                </p>
              </div>
            {:else}
              <PdfDropzone
                bind:file={selectedFile}
                maxBytes={maxPdfBytes}
                disabled={isSaving}
                onError={(message) => toast.error(message)}
              />
            {/if}
            {#if localPreviewUrl}
              <iframe
                src={`${localPreviewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                title="Selected PDF preview"
                class="h-80 w-full rounded-xl border bg-muted"
              ></iframe>
            {/if}
          </div>
        </div>
      </Card.Content>
      <Card.Footer class="justify-end gap-2">
        <Button variant="outline" onclick={resetForm} disabled={isSaving}>Cancel</Button>
        <Button onclick={savePublication} isLoading={isSaving}>
          {editingId ? "Save Changes" : "Upload Publication"}
        </Button>
      </Card.Footer>
    </Card.Root>
  {/if}

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-3" onclick={loadPublications} icon={RefreshCw}>
        Try Again
      </Button>
    </ErrorView>
  {:else if configured === false}
    <EmptyView
      title="Publication management is not configured."
      description="Add the portal Supabase, Google Drive, and Firebase server credentials to HAOne."
    >
      {#snippet icon()}<FileText class="h-8 w-8 text-muted-foreground" />{/snippet}
    </EmptyView>
  {:else}
    {#if !previewConfigured}
      <div
        class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        Firestore preview storage is not configured. PDF uploads will still succeed, but preview
        generation will return a warning.
      </div>
    {/if}

    <div class="flex flex-col gap-3 sm:flex-row">
      <div class="relative flex-1">
        <Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input bind:value={search} placeholder="Search publications…" class="pl-9" />
      </div>
      <select
        bind:value={statusFilter}
        class="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="all">All statuses</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
      <select
        bind:value={dateSort}
        aria-label="Sort by publication date"
        class="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="desc">Latest first</option>
        <option value="asc">Oldest first</option>
      </select>
    </div>

    {#if filtered.length === 0}
      <EmptyView
        title="No publications found."
        description="Add a publication or adjust your search and status filter."
      >
        {#snippet icon()}<FileText class="h-8 w-8 text-muted-foreground" />{/snippet}
      </EmptyView>
    {:else}
      <div class="rounded-md border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Publication</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Date</Table.Head>
              <Table.Head class="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each filtered as publication (publication.id)}
              <Table.Row>
                <Table.Cell class="whitespace-normal">
                  <div class="max-w-xl min-w-60">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{publication.title}</span>
                      {#if publication.is_featured}
                        <Badge class="bg-brand/10 text-brand">Featured</Badge>
                      {/if}
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {publication.memo_number} · {publication.document_type}
                    </p>
                    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {publication.description || "No description"}
                    </p>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="outline" class={statusClass(publication.status)}>
                    {publication.status.charAt(0).toUpperCase() + publication.status.slice(1)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{new Date(publication.published_at).toLocaleDateString()}</Table.Cell>
                <Table.Cell>
                  <div class="flex min-w-max justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      href={publication.drive_view_url}
                      target="_blank"
                      aria-label="View PDF"
                      title="View PDF"
                      icon={ExternalLink}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => openEdit(publication)}
                      aria-label="Edit publication"
                      title="Edit publication"
                      icon={Pencil}
                    />
                    {#if publication.status !== "published"}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onclick={() => patchPublication(publication, { status: "published" })}
                        disabled={busyId === publication.id}
                        aria-label="Publish"
                        title="Publish"
                        icon={Eye}
                      />
                    {:else}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onclick={() => patchPublication(publication, { status: "archived" })}
                        disabled={busyId === publication.id}
                        aria-label="Archive"
                        title="Archive"
                        icon={Archive}
                      />
                    {/if}
                    <Button
                      variant={publication.is_featured ? "secondary" : "ghost"}
                      size="icon-sm"
                      onclick={() =>
                        patchPublication(publication, {
                          isFeatured: !publication.is_featured,
                          status: "published"
                        })}
                      disabled={busyId === publication.id}
                      aria-label={publication.is_featured ? "Remove featured status" : "Feature"}
                      title={publication.is_featured
                        ? "Remove featured status"
                        : "Feature publication"}
                      icon={Sparkles}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => regeneratePreview(publication)}
                      disabled={!previewConfigured || busyId === publication.id}
                      aria-label="Regenerate preview"
                      title="Regenerate preview"
                      icon={RefreshCw}
                    />
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onclick={() => confirmDelete(publication)}
                      disabled={busyId === publication.id}
                      aria-label="Permanently delete"
                      title="Permanently delete"
                      icon={Trash2}
                    />
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}
  {/if}
</div>
