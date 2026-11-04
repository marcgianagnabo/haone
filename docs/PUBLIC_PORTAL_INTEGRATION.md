# HAOne → NFRH Public Portal

HAOne is the authenticated source and sole writer. The NFRH Portal is public,
read-only, and must never receive credentials that can access HAOne.

## Snapshot contract

HAOne publishes the official `TERM_CURR` only. The server validates the term and
calls one destination operation:

```ts
secondary.rpc("replace_public_snapshot", { p_snapshot: snapshot });
```

```ts
interface PublicPortalSnapshotV1 {
  schema_version: 1;
  period: string;
  generated_at: string;
  journal: PublicJournalEntry[];
  officers: PublicOfficerEntry[];
}

interface PublicJournalEntry {
  entry_key: string;
  sort_seq: number;
  date: string;
  period: string;
  type: string;
  water: number;
  assoc: number;
  maintenance: number;
  gas: number;
  misc: number;
  amount: number;
  was_audited: boolean;
}

interface PublicOfficerEntry {
  officer_key: string;
  sort_seq: number;
  term: string;
  position: string;
  display_name: string;
  committee: string | null;
  photo_url: string | null;
}
```

The destination must return:

```json
{
  "success": true,
  "schema_version": 1,
  "period": "2627_1S",
  "journal_count": 250,
  "officer_count": 8,
  "synced_at": "2026-11-04T08:30:01.000Z"
}
```

HAOne rejects the response unless its version, period, and counts match the
snapshot it submitted.

## Redaction

Journal keys are SHA-256 hashes of source UUIDs. Rows are ordered by date,
creation time, and source UUID before `sort_seq` is assigned. Amounts are rounded
to two decimal places and include gas. Waived rows are retained but excluded from
the preview balance.

Journal payloads never include names, MOP, notes, source IDs, account IDs,
creator IDs, references, receipts, email addresses, or student numbers.

Only active officers in `TERM_CURR` are included. Public display names use the
nickname first and otherwise given names only. Officers without a safe display
name or position are excluded. Only manually managed `photo_url` values are
used; automatic Google profile photos are never selected. Officer payloads never
include surnames by default, email, birthday, room, Facebook, source IDs,
account IDs, timestamps, raw rows, authentication, or permission data.

## Destination requirements

The NFRH Portal project owns its tables, migration, validation, and RLS. Its
`replace_public_snapshot(jsonb)` function must validate schema version 1, reject
invalid payloads, replace journal/officers/metadata in one transaction, and roll
back every change if any part fails. Only `service_role` may execute it. Public
roles may only read approved portal data.

HAOne does not include destination SQL and does not read destination tables. The
destination RPC is its only secondary Supabase operation.

## Configuration

The following values are server-only and must never use a `PUBLIC_` prefix:

```env
SECONDARY_SUPABASE_URL=
SECONDARY_SUPABASE_SERVICE_ROLE_KEY=
```

## Publication CMS boundary

The HAOne Portal navigation owns publication management. Its additional
server-only configuration is:

```env
PORTAL_GOOGLE_SERVICE_ACCOUNT_JSON=
PORTAL_GOOGLE_SHARED_DRIVE_ID=
PORTAL_GOOGLE_PUBLICATIONS_FOLDER_ID=
PORTAL_FIREBASE_PROJECT_ID=
PORTAL_FIREBASE_SERVICE_ACCOUNT_JSON=
PORTAL_FIRESTORE_PUBLICATION_COLLECTION=publication_previews
PORTAL_MAX_PDF_BYTES=20971520
PORTAL_MAX_PREVIEW_BYTES=307200
```

The complete HAOne Publications & Sync feature is controlled by:

```env
PUBLIC_PORTAL_FEATURE_ENABLED=true
```

Set it to `false` to hide the Portal navigation and block the Portal admin pages
and APIs. The default is enabled. Homepage customization is a future phase and
will reuse the single featured publication enforced by the publication service.

HAOne validates PDF type and size, uploads the file to the configured Shared
Drive folder, creates the secondary Supabase publication record, waits for a
Drive thumbnail, keeps reducing the provider-generated thumbnail dimensions
until it is within the preview limit, and stores it in Firestore. A preview
failure is returned as a warning and does not undo a successful publication.

Create, edit, publish, archive, feature, unfeature, preview regeneration, and
permanent deletion are authenticated HAOne operations. The initial database
slug is retained as a legacy redirect alias when a title changes; the portal
continues deriving its canonical public URL from the current title only.

The public portal must remain read-only and must not regain admin routes,
authentication, allowlists, or write APIs. Homepage-content management remains
a separate HAOne phase.
