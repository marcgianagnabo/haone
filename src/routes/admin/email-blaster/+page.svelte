<script lang="ts">
  import { onMount, tick } from "svelte";
  import Papa from "papaparse";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import RichTextEditor from "$components/editor/RichTextEditor.svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { createEmail, sendEmail } from "$api/services/gmail-service";
  import {
    listEmailBlastDrafts,
    saveEmailBlastDraft,
    type EmailBlastDraft,
    type EmailBlastRecipient
  } from "$api/services/email-blast-service";
  import { auth } from "$state/auth.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { wrapEmailHtml } from "$templates/base";
  import { toast } from "svelte-sonner";
  import { Download, FileUp, Mail, RefreshCcw, Save, Send, Users } from "@lucide/svelte";

  type Source = "haone" | "csv";

  const DEFAULT_SUBJECT = "HAOne Update: {{name}}";
  const DEFAULT_BODY =
    "<p>Hello {{name}},</p><p>Write your message here. Use the merge-field buttons to personalize it.</p>";
  const brandPrefix = $derived(`[${brandingState.profile.shortName || "NFRH"}]`);

  let source = $state<Source>("haone");
  let recipients = $state<EmailBlastRecipient[]>([]);
  let usersLoading = $state(false);
  let isSending = $state(false);
  let isSaving = $state(false);
  let sendProgress = $state(0);
  let subject = $state(DEFAULT_SUBJECT);
  let bodyHtml = $state(DEFAULT_BODY);
  let campaignName = $state("Untitled Email");
  let search = $state("");
  let previewRecipientId = $state("");
  let csvHeaders = $state<string[]>([]);
  let csvRows = $state<Record<string, string>[]>([]);
  let emailColumn = $state("");
  let draftId = $state<string | null>(null);
  let drafts = $state<EmailBlastDraft[]>([]);
  let selectedDraft = $state("");
  let editorActions = $state<{
    uploadImages: () => Promise<void>;
    insertText?: (text: string) => void;
  }>();

  const selectedRecipients = $derived(recipients.filter((recipient) => recipient.selected));
  const visibleRecipients = $derived.by(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (recipient) =>
        recipient.email.toLowerCase().includes(term) ||
        recipient.name.toLowerCase().includes(term) ||
        Object.values(recipient.fields).some((value) => value.toLowerCase().includes(term))
    );
  });
  const currentPreview = $derived(
    recipients.find((recipient) => recipient.id === previewRecipientId) ||
      selectedRecipients[0] ||
      recipients[0]
  );
  const mergeFields = $derived(
    Array.from(new Set(recipients.flatMap((recipient) => Object.keys(recipient.fields)))).sort()
  );
  const personalizedSubject = $derived(
    withBrandingPrefix(currentPreview ? mergeTemplate(subject, currentPreview.fields) : subject)
  );
  const previewHtml = $derived(
    wrapEmailHtml(
      currentPreview ? mergeHtml(bodyHtml, currentPreview.fields) : bodyHtml,
      brandingState.profile.emailHeaderUrl,
      brandingState.profile.replyTo
    )
  );

  function normalizeKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function mergeTemplate(template: string, fields: Record<string, string>) {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, field: string) => {
      const key = normalizeKey(field);
      return fields[key] ?? fields[field] ?? match;
    });
  }

  function withBrandingPrefix(value: string) {
    const cleanSubject = value.trim();
    const escapedPrefix = brandPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withoutDuplicate = cleanSubject.replace(new RegExp(`^${escapedPrefix}\\s*`, "i"), "");
    return `${brandPrefix} ${withoutDuplicate}`.trim();
  }

  function mergeHtml(template: string, fields: Record<string, string>) {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, field: string) => {
      const key = normalizeKey(field);
      const value = fields[key] ?? fields[field];
      return value === undefined ? match : escapeHtml(value);
    });
  }

  function userToRecipient(user: Awaited<ReturnType<typeof fetchUsers>>[number]) {
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const fullName =
      user.displayNameFormal ||
      user.displayName ||
      [firstName, user.middleName, lastName, user.suffix].filter(Boolean).join(" ");
    const fields: Record<string, string> = {
      name: fullName,
      email: user.email || "",
      first_name: firstName,
      firstName,
      last_name: lastName,
      lastName,
      middle_name: user.middleName || "",
      student_no: user.studentNo || "",
      studentNo: user.studentNo || "",
      college: user.college || "",
      program: user.program || "",
      tags: user.tags || ""
    };
    return {
      id: `haone-${user.id || user.email}`,
      email: (user.email || "").trim(),
      name: fullName,
      fields,
      selected: false,
      sendStatus: "ready" as const
    };
  }

  async function loadHaoneRecipients() {
    usersLoading = true;
    try {
      const users = await fetchUsers(true);
      const seen = new Set<string>();
      recipients = users.map(userToRecipient).filter((recipient) => {
        const email = recipient.email.toLowerCase();
        if (!email || !email.includes("@") || seen.has(email)) return false;
        seen.add(email);
        return true;
      });
      source = "haone";
      csvHeaders = [];
      csvRows = [];
      emailColumn = "";
      previewRecipientId = recipients[0]?.id || "";
      toast.success(
        `Loaded ${recipients.length} HAOne email address${recipients.length === 1 ? "" : "es"}`
      );
    } catch (error: any) {
      toast.error(error?.message || "Could not load HAOne users.");
    } finally {
      usersLoading = false;
    }
  }

  function makeCsvRecipients() {
    if (!emailColumn) {
      recipients = [];
      return;
    }
    const normalizedEmailKey = normalizeKey(emailColumn);
    const seen = new Set<string>();
    recipients = csvRows
      .map((row, index) => {
        const fields: Record<string, string> = {};
        for (const header of csvHeaders) {
          const key = normalizeKey(header);
          if (key) fields[key] = String(row[header] ?? "").trim();
        }
        const email = String(row[emailColumn] ?? "").trim();
        const first = fields.first_name || fields.firstname || "";
        const last = fields.last_name || fields.lastname || "";
        const name =
          fields.name || [first, fields.middle_name, last].filter(Boolean).join(" ") || email;
        fields[normalizedEmailKey] = email;
        fields.email = email;
        fields.name = name;
        return {
          id: `csv-${index}-${email.toLowerCase()}`,
          email,
          name,
          fields,
          selected: false,
          sendStatus: "ready" as const
        };
      })
      .filter((recipient) => {
        const normalizedEmail = recipient.email.toLowerCase();
        if (!normalizedEmail.includes("@") || seen.has(normalizedEmail)) return false;
        seen.add(normalizedEmail);
        return true;
      });
    previewRecipientId = recipients[0]?.id || "";
  }

  function handleCsvImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        if (!result.meta.fields?.length) {
          toast.error("The CSV file needs a header row.");
          return;
        }
        csvHeaders = result.meta.fields;
        csvRows = result.data;
        emailColumn =
          csvHeaders.find((header) =>
            ["email", "e_mail", "email_address"].includes(normalizeKey(header))
          ) || "";
        source = "csv";
        makeCsvRecipients();
        if (!emailColumn) {
          toast.warning("Choose which CSV column contains recipient email addresses.");
        } else {
          toast.success(`Imported ${recipients.length} recipient rows`);
        }
      },
      error: (error) => toast.error(`CSV import failed: ${error.message}`)
    });
    input.value = "";
  }

  function updateEmailColumn(event: Event) {
    emailColumn = (event.currentTarget as HTMLSelectElement).value;
    makeCsvRecipients();
  }

  function toggleRecipient(id: string) {
    recipients = recipients.map((recipient) =>
      recipient.id === id ? { ...recipient, selected: !recipient.selected } : recipient
    );
  }

  function toggleVisibleRecipients(event: Event) {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    const visibleIds = new Set(visibleRecipients.map((recipient) => recipient.id));
    recipients = recipients.map((recipient) =>
      visibleIds.has(recipient.id) ? { ...recipient, selected: checked } : recipient
    );
  }

  function exportCsv() {
    if (!selectedRecipients.length) {
      toast.error("Select at least one recipient to export.");
      return;
    }
    const keys = Array.from(
      new Set([
        "name",
        "email",
        ...selectedRecipients.flatMap((recipient) => Object.keys(recipient.fields))
      ])
    );
    const rows = selectedRecipients.map((recipient) => {
      const row: Record<string, string> = {};
      for (const key of keys) {
        let value = key === "email" ? recipient.email : (recipient.fields[key] ?? "");
        if (/^[=+\-@]/.test(value)) value = `'${value}`;
        row[key] = value;
      }
      row.send_status = recipient.sendStatus;
      return row;
    });
    const csv = Papa.unparse(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${normalizeKey(campaignName) || "email-blast-recipients"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function buildDraft(): EmailBlastDraft {
    if (!auth.userId) throw new Error("Could not identify the signed-in admin.");
    return {
      id: draftId || crypto.randomUUID(),
      creatorId: auth.userId,
      name: campaignName.trim() || "Untitled Email",
      source,
      subject,
      bodyHtml,
      recipients,
      updatedAt: new Date().toISOString()
    };
  }

  async function saveDraft(silent = false) {
    if (!silent) isSaving = true;
    try {
      await editorActions?.uploadImages();
      await tick();
      const saved = await saveEmailBlastDraft(buildDraft());
      draftId = saved.id;
      selectedDraft = saved.id;
      drafts = [saved, ...drafts.filter((draft) => draft.id !== saved.id)];
      if (!silent) toast.success("Email blast draft saved.");
      return saved;
    } catch (error: any) {
      if (!silent) toast.error(error?.message || "Could not save this draft.");
      throw error;
    } finally {
      if (!silent) isSaving = false;
    }
  }

  async function refreshDrafts() {
    try {
      drafts = await listEmailBlastDrafts();
    } catch (error: any) {
      // A missing migration should not prevent composing or importing recipient data.
      console.warn("Email blast drafts are unavailable:", error?.message || error);
    }
  }

  function loadDraft(event: Event) {
    const id = (event.currentTarget as HTMLSelectElement).value;
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return;
    draftId = draft.id;
    selectedDraft = draft.id;
    campaignName = draft.name;
    source = draft.source;
    subject = draft.subject;
    bodyHtml = draft.bodyHtml;
    recipients = draft.recipients || [];
    csvHeaders =
      source === "csv"
        ? Array.from(new Set(recipients.flatMap((recipient) => Object.keys(recipient.fields))))
        : [];
    emailColumn = "email";
    previewRecipientId = recipients[0]?.id || "";
    toast.success(`Loaded “${draft.name}”`);
  }

  function newDraft() {
    draftId = null;
    selectedDraft = "";
    campaignName = "Untitled Email";
    subject = DEFAULT_SUBJECT;
    bodyHtml = DEFAULT_BODY;
    recipients = [];
    source = "haone";
    csvHeaders = [];
    csvRows = [];
    emailColumn = "";
    previewRecipientId = "";
  }

  async function sendBatch() {
    const targets = selectedRecipients.filter((recipient) => recipient.sendStatus !== "sent");
    if (!targets.length) {
      toast.error("Select recipients who have not already been sent this message.");
      return;
    }
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("Subject and email body are required.");
      return;
    }
    if (!auth.accessToken) {
      toast.error("Gmail authorization is missing. Sign in again before sending.");
      return;
    }

    isSending = true;
    sendProgress = 0;
    try {
      // Save first so the recipients and draft exist before any send starts.
      await saveDraft(true);
      let sent = 0;
      let failed = 0;
      for (const recipient of targets) {
        try {
          const mergedSubject = withBrandingPrefix(
            mergeTemplate(subject, recipient.fields).replace(/[\r\n]+/g, " ")
          );
          const mergedBody = wrapEmailHtml(
            mergeHtml(bodyHtml, recipient.fields),
            brandingState.profile.emailHeaderUrl,
            brandingState.profile.replyTo
          );
          const raw = createEmail(
            recipient.email,
            mergedSubject,
            mergedBody,
            brandingState.profile.replyTo
          );
          await sendEmail(auth.accessToken, raw);
          recipients = recipients.map((item) =>
            item.id === recipient.id ? { ...item, sendStatus: "sent", sendError: undefined } : item
          );
          sent += 1;
        } catch (error: any) {
          recipients = recipients.map((item) =>
            item.id === recipient.id
              ? { ...item, sendStatus: "failed", sendError: error?.message || "Send failed" }
              : item
          );
          failed += 1;
        }
        sendProgress = Math.round(((sent + failed) / targets.length) * 100);
        // Persist recipient status after every attempt so retries skip successes.
        await saveDraft(true);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      toast[failed ? "warning" : "success"](
        `Email batch finished: ${sent} sent${failed ? `, ${failed} failed` : ""}.`
      );
    } catch (error: any) {
      toast.error(error?.message || "Email batch stopped because the draft could not be saved.");
    } finally {
      isSending = false;
    }
  }

  onMount(() => {
    pageState.title = "Email Blaster";
    void refreshDrafts();
  });
</script>

<div class="mx-auto max-w-7xl space-y-4">
  <ContentHeader title="Email Blaster" isTopLevel={true} />

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2"><Mail class="size-5" /> Campaign</Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
      <div class="space-y-2">
        <Label for="campaignName">Draft name</Label>
        <Input
          id="campaignName"
          bind:value={campaignName}
          placeholder="e.g. Semester payment reminder"
        />
      </div>
      <div class="space-y-2">
        <Label for="savedDrafts">Saved drafts</Label>
        <select
          id="savedDrafts"
          class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selectedDraft}
          onchange={loadDraft}
        >
          <option value="">Choose a saved draft…</option>
          {#each drafts as draft}
            <option value={draft.id}
              >{draft.name} · {new Date(draft.updatedAt).toLocaleDateString()}</option
            >
          {/each}
        </select>
      </div>
      <Button variant="outline" onclick={newDraft} disabled={isSending}>New draft</Button>
      <Button onclick={() => saveDraft()} isLoading={isSaving} disabled={isSending} icon={Save}>
        Save draft
      </Button>
    </Card.Content>
  </Card.Root>

  <div class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
    <div class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2"
            ><Users class="size-5" /> Recipients</Card.Title
          >
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <label
              class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              <FileUp class="size-4" /> Import CSV
              <input
                class="sr-only"
                type="file"
                accept=".csv,text/csv"
                onchange={handleCsvImport}
              />
            </label>
            <Button
              variant="outline"
              onclick={loadHaoneRecipients}
              isLoading={usersLoading}
              icon={RefreshCcw}>Load HAOne recipients</Button
            >
            {#if source === "csv" && csvHeaders.length}
              <div class="flex items-center gap-2">
                <Label for="emailColumn" class="whitespace-nowrap">Email column</Label>
                <select
                  id="emailColumn"
                  class="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={emailColumn}
                  onchange={updateEmailColumn}
                >
                  <option value="">Select column…</option>
                  {#each csvHeaders as header}
                    <option value={header}>{header}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          {#if recipients.length}
            <div class="flex flex-wrap items-center justify-between gap-3">
              <Input
                class="max-w-sm"
                bind:value={search}
                placeholder="Search name, email, or data…"
              />
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">
                  {selectedRecipients.length} selected · {recipients.length} total
                </span>
                <Button variant="outline" size="sm" onclick={exportCsv} icon={Download}>
                  Export selected CSV
                </Button>
              </div>
            </div>

            <div class="max-h-80 overflow-auto rounded-md border">
              <table class="w-full text-left text-sm">
                <thead class="sticky top-0 bg-muted text-xs uppercase">
                  <tr>
                    <th class="w-10 p-3">
                      <input
                        type="checkbox"
                        aria-label="Select all visible recipients"
                        checked={visibleRecipients.length > 0 &&
                          visibleRecipients.every((recipient) => recipient.selected)}
                        onchange={toggleVisibleRecipients}
                      />
                    </th>
                    <th class="p-3">Name</th>
                    <th class="p-3">Email</th>
                    <th class="p-3">Status</th>
                    <th class="p-3">Preview</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  {#each visibleRecipients as recipient (recipient.id)}
                    <tr>
                      <td class="p-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${recipient.email}`}
                          checked={recipient.selected}
                          onchange={() => toggleRecipient(recipient.id)}
                        />
                      </td>
                      <td class="p-3">{recipient.name || "—"}</td>
                      <td class="p-3">{recipient.email}</td>
                      <td class="p-3">
                        <span
                          class={recipient.sendStatus === "sent"
                            ? "text-green-700"
                            : recipient.sendStatus === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"}
                          title={recipient.sendError || ""}>{recipient.sendStatus}</span
                        >
                      </td>
                      <td class="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onclick={() => (previewRecipientId = recipient.id)}>View</Button
                        >
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div
              class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
            >
              No recipients loaded.
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Email content</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-5">
          <div class="space-y-2">
            <Label for="emailSubject">Subject</Label>
            <div class="flex items-center gap-2">
              <span class="shrink-0 rounded-md border bg-muted px-3 py-2 text-sm font-semibold">
                {brandPrefix}
              </span>
              <Input id="emailSubject" bind:value={subject} placeholder="Email subject" />
            </div>
          </div>
          <div class="space-y-2">
            <Label>Email body</Label>
            <RichTextEditor
              bind:content={bodyHtml}
              bind:actions={editorActions}
              placeholder="Compose your email…"
              enableFontSize={true}
            />
          </div>
          {#if mergeFields.length}
            <div class="space-y-2">
              <p class="text-sm font-medium">Insert merge field</p>
              <div class="flex flex-wrap gap-2">
                {#each mergeFields as field}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editorActions?.insertText}
                    onclick={() => editorActions?.insertText?.(`{{${field}}}`)}
                    >{`{{${field}}}`}</Button
                  >
                {/each}
              </div>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <div class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Email preview</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-3">
          {#if currentPreview}
            <div class="rounded-md border bg-muted/20 p-3 text-sm">
              <p><strong>To:</strong> {currentPreview.email}</p>
              <p class="mt-1"><strong>Subject:</strong> {personalizedSubject}</p>
            </div>
            <iframe
              title="Personalized email preview"
              sandbox=""
              srcdoc={previewHtml}
              class="h-[680px] w-full rounded-md border bg-white"
            ></iframe>
          {:else}
            <div
              class="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
            >
              Your branded email preview will appear here.
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Send batch</Card.Title>
          <Card.Description>
            Emails are sent individually through your authorized Gmail account. Successfully sent
            recipients are skipped on retry.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          {#if isSending}
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span>Progress</span><span>{sendProgress}%</span>
              </div>
              <progress class="h-2 w-full" max="100" value={sendProgress}></progress>
            </div>
          {/if}
          <Button
            class="w-full"
            onclick={sendBatch}
            disabled={isSending ||
              !selectedRecipients.some((recipient) => recipient.sendStatus !== "sent")}
            isLoading={isSending}
            icon={Send}
          >
            Send {selectedRecipients.filter((recipient) => recipient.sendStatus !== "sent").length} email(s)
          </Button>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
