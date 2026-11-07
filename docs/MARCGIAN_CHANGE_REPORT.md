# HAOne — MarcGian Change Report

## 1. Report scope

This report documents the changes unique to Marc Gian Agnabo's HAOne fork.

| Item                | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| Repository          | [`marcgianagnabo/haone`](https://github.com/marcgianagnabo/haone) |
| Reviewed branch     | `master`                                                          |
| Upstream comparison | `fofajardo/haone:development`                                     |
| Reporting period    | September 23, 2026 to November 4, 2026                            |
| Unique commits      | 122                                                               |
| Files changed       | 221                                                               |
| Lines added         | 13,441                                                            |
| Lines deleted       | 1,709                                                             |
| File status         | 69 added, 150 modified, 2 removed                                 |

The fork's `master` and `production` branches pointed to the same commit (`2bd613a`) when this report was prepared. The fork was 122 commits ahead of and 10 commits behind upstream `development`. Inherited upstream commits are excluded.

### Method

The figures and commit inventory come from GitHub's cross-fork comparison of upstream `development` against `marcgianagnabo:master`. The functional summary was verified against the changed files, migrations, and project documentation in the fork. Statistics describe source changes and do not measure runtime usage or production data changes.

## 2. Executive summary

The fork significantly extended HAOne from its upstream state. The work concentrated on:

- expanding accounting with maintenance and gas fees, stronger transaction controls, audited-state reporting, and additional payment channels;
- making Supabase installations safer through migrations, RLS corrections, identity linking, baseline schema scripts, and deployment documentation;
- redesigning laundry booking around wing-specific machines, fixed slots, booking limits, resident visibility, and mobile-friendly controls;
- improving onboarding, resident synchronization, officer access, and automated approval notifications;
- hardening authentication and navigation on iOS Safari and in-app browsers, with retained production diagnostics;
- improving mobile layout, PWA installation, push-notification enrollment, branding, officer profiles, and public-facing imagery; and
- adding HAOne-managed public-portal synchronization, publication management, and homepage administration with privacy-focused data redaction.

Of the 122 unique commits, 51 are explicitly marked as fixes, 43 as features, 6 as documentation, 5 as chores, 3 as reverts, and the remainder as updates, styling, assets, or uncategorized changes.

## 3. Major changes by area

### 3.1 Financial management and reporting

- Added **maintenance** and **gas** fee fields to journal entries, payment requests, receipts, reports, and database migrations.
- Added Supabase support for electronic receipts and public receipt lookup.
- Added an **Audited** tag and transaction filtering to make reviewed transactions easier to identify.
- Fixed financial-report export and expanded PDF/report output for the new fee categories.
- Improved transaction-type selection with grouping, colors, descriptions, and visible money-in/money-out direction.
- Corrected displayed fee magnitudes and collection-refund calculations.
- Capped refunds at the amount actually collected and displayed the true remaining refundable balance.
- Added fund carryover support, first across academic years and later across semesters.
- Removed collection periods and integrated fees into academic-term creation.
- Split dorm-fee and miscellaneous payments so `COLLECTION_OTHERS` remains miscellaneous-only; database checks enforce the rule.
- Added **GoTyme Bank** and **MariBank** payment methods.
- Restored carryover to the manual add-transaction workflow after reverting the newer automatic behavior.

### 3.2 Supabase schema, migrations, and data integrity

- Added migrations for laundry visibility, maintenance/gas fees, laundry machine area, resident payment cancellation, occupied-bed lookup, student-number checking, achievement eligibility, terms and fee constants, payment methods, auth linking, officer photos, laundry booker names, and RLS corrections.
- Added a consolidated baseline for new installations:
  - `migrations/baseline/000_baseline_schema.sql`
  - `migrations/baseline/001_reference_seed.sql`
- Made the baseline refuse to run over an existing HAOne schema, reducing accidental data-loss risk.
- Kept historical numbered migrations as the upgrade and audit path for existing deployments.
- Added guarded test-data cleanup tooling and a test-data manifest format.
- Resolved real resident IDs before journal, payment-request, laundry, and fridge writes to satisfy foreign keys and RLS.
- Added automatic linking between `public.users` profiles and Supabase Auth identities to prevent approved residents from being trapped in onboarding.
- Removed unsafe `user_metadata` fallbacks from registration RLS, officer checks, and student-number lookup.
- Added RLS-safe RPCs for public clearance verification, occupied beds, duplicate student numbers, achievement counts, receipt lookup, and laundry booker names.
- Seeded required terms, fees, feature flags, system accounts, and payment methods while separating production reference data from dummy fixtures.

### 3.3 Resident onboarding and administration

- Connected resident registration to the administrator approval workflow.
- Added an onboarding gate and standardized student numbers into a dashed format.
- Fixed student-number backfill and duplicate-check behavior.
- Fixed bulk resident selection to use account IDs instead of student numbers.
- Added numbered synchronization cards and pending-resident counts, including a badge on the Residents Sync tab.
- Added automatic Gmail notices for approved and declined registrations.
- Removed bulk approval to keep approval actions and notifications explicit.
- Preserved resident access after a declined registration while preventing invalid duplicate submissions.
- Granted the configured instance administrator officer-level privilege by default, independently of the elected officer list.
- Improved the academic-term form and fee upsert behavior.
- Hid Database Sync from normal navigation while retaining its page and service for authorized use.

### 3.4 Laundry booking

- Added left-wing and right-wing machine/area selection.
- Connected selected machines to the calendar and booking flow.
- Standardized booking into fixed two-hour slots and added an administrator 24-hour grid.
- Limited normal bookings to the current Monday-to-Sunday week.
- Added one-active-booking enforcement and closed past-day interfaces.
- Focused the booking interface on the selected wing and auto-centered the week scroller on today.
- Added resident-visible booker name and room information while keeping transient users masked.
- Added a temporary October 12–25 advance-booking promotion and subsequently corrected which week was open.
- Added clearer booking rules and removed redundant “Book Slot” header shortcuts.
- Added laundry dashboard integration and occupancy-card profile photos.
- Improved callback typing and reliability of today-centering behavior.

### 3.5 Fridge management

- Corrected resident identity handling for fridge operations under Supabase RLS.
- Added distinct **Take Photo** and **Upload** actions for fridge-item images.
- Enabled mobile devices to offer the camera directly for image capture.
- Added Fridge to both resident and administrator mobile navigation.

### 3.6 Authentication, authorization, and session handling

- Added a post-login workspace picker for users who can enter both resident and officer workspaces.
- Added a dedicated House Council sign-in path and later restored the post-login workspace picker for officers.
- Added inactivity logout, initially at 15 minutes and finalized at **10 minutes** with simplified messaging.
- Hardened OAuth callback handling for iOS Safari and in-app browsers:
  - persisted PKCE data across session storage, local storage, and cookies;
  - added state validation and single-use callback handling;
  - used full-page navigation after authentication where client routing was unreliable;
  - persisted workspace handoff across reloads; and
  - guarded against redirect races and repeated error-boundary loops.
- Added client-side diagnostic trails, raw-error capture, a `/api/client-log` beacon, visible error reports, and stale-chunk recovery.
- Wrapped background synchronization and dynamic imports so rejected promises no longer trigger unexplained client error pages.
- Retained the diagnostics after resolving the iPhone post-sign-in incident for future production troubleshooting.

### 3.7 Notifications and PWA behavior

- Added loading feedback while checking or changing push-notification subscriptions.
- Added a forced notification prompt on the resident dashboard.
- Added a PWA installation card near sign-out and re-prompt behavior for unsubscribed users.
- Fixed the missing PWA-install state store required by the layout.
- Improved push subscription retries, VAPID compatibility, and dismissal handling.
- Fixed notification-prompt overflow on desktop.
- Corrected dispatcher queue handling so successful sends are cleared and retries do not resend completed items.

### 3.8 Mobile interface, branding, and public presentation

- Pinned the mobile header and bottom navigation while respecting safe-area offsets.
- Improved stacking of the logo bar, sticky titles, content, and current-time indicator.
- Reduced base typography on small screens.
- Added photo backdrops to sign-in, onboarding, and landing pages.
- Added and revised NFRH light/dark logos and hero photographs.
- Added “My home far away from home” as a front-page hero image and optimized portal heroes for social previews.
- Added Google Search Console verification.
- Added officer photos, larger side-by-side officer cards, photo previews, committee layout improvements, and Facebook links.
- Removed the officer privacy visibility toggle and simplified displayed officer names/titles.
- Added Facebook page and group links to onboarding.
- Fixed header state carrying across navigation and announcement paragraph formatting.

### 3.9 Public portal administration and synchronization

- Added a Portal administration area for publications, homepage content, and public-data synchronization.
- Added publication create, edit, publish, archive, feature, preview regeneration, and permanent-delete operations.
- Integrated publication PDFs with Google Shared Drive and preview images with Firestore.
- Added server-side validation for file type and size, thumbnail reduction, slug management, and legacy aliases.
- Added a public snapshot synchronization service for the current academic term.
- Restricted the public snapshot to redacted journal and officer fields:
  - source IDs are replaced with SHA-256 keys;
  - names, emails, student numbers, payment methods, notes, receipts, and permission data are excluded from journal rows;
  - officer output uses safe display names and manually managed photos only; and
  - destination counts, term, and schema version are validated after synchronization.
- Kept the public portal read-only and isolated its service-role credentials as server-only environment variables.
- Added a feature flag that hides and blocks Portal administration when disabled.
- Added a public snapshot status/sync card and supporting API routes.

### 3.10 Documentation, setup, and repository hygiene

- Added a full setup and deployment guide for Supabase, Google OAuth, Firestore, push notifications, scheduled jobs, and Cloudflare Workers.
- Added a migration guide with ordering, safety warnings, verification queries, troubleshooting, and identity-linking rules.
- Added documentation for guarded test-data cleanup.
- Added a production bug ledger describing the iPhone authentication incident, diagnosis, fixes, and verification.
- Added the public-portal integration contract and its privacy boundary.
- Added build-time restoration of private configuration and scripts for bundling/restoring `src-private` data.
- Ensured custom-route link targets are present on fresh builds.
- Removed obsolete branding files and an unsafe private-assets symlink.
- Expanded `.gitignore` coverage for Wrangler configuration, OAuth client files, and private assets.

## 4. Important final-state decisions and reverts

Some commits implemented temporary behavior that was later reverted. The final branch state is:

1. **Officer workspace selection:** the post-login workspace picker is restored for officers (`a29f20e`).
2. **Transaction carryover:** carryover is returned to the manual add-transaction flow (`5a859a9`).
3. **Admin page gating:** the attempted restriction of receipt dispatch and academic terms to officers was immediately reverted (`50ba6d3`).
4. **Officer one-trip sign-in:** the one-trip login experiment was reverted; Sheets-scope gating was retained (`45afe3c`).
5. **Session timeout:** the final inactivity timeout is 10 minutes, superseding the earlier 15-minute implementation.

## 5. Operational and security impact

### Deployment actions

- Apply only the migrations appropriate to the target database. New empty installations should use the consolidated baseline; existing installations should use later numbered migrations only.
- Configure the Supabase URL and publishable key, OAuth credentials, JWT secret, and any optional Firestore, VAPID, cron, and portal credentials.
- Add the public-portal secondary Supabase and publication-service credentials only when the Portal feature is enabled.
- Verify `INSTANCE_ADMIN`, current academic term, fee constants, payment methods, and at least one authorized officer.
- Confirm Cloudflare secrets are stored as secrets rather than public environment values.

### Breaking or behavior-changing items

- The database expects additional maintenance, gas, laundry-machine, officer-photo, and identity-linking fields/functions.
- Registration and resident access now rely on linked Supabase Auth identities rather than `user_metadata` fallbacks.
- Laundry uses machine areas, fixed slot rules, and one-active-booking constraints.
- `COLLECTION_OTHERS` is database-constrained to miscellaneous amounts.
- Officers who also have resident access encounter a workspace-selection flow after authentication.
- Authenticated sessions expire after 10 minutes of inactivity.

### Security improvements

- RLS-sensitive operations resolve linked resident IDs instead of trusting client-provided identity fields.
- Public receipt, clearance, achievement, occupancy, and laundry lookups use narrowly scoped RPCs.
- Public portal synchronization uses server-only service credentials and a redacted, versioned snapshot contract.
- Private configuration, OAuth files, service credentials, and Wrangler configuration are excluded from source control.

## 6. Change distribution

| Date       | Unique commits |
| ---------- | -------------: |
| 2026-09-23 |             14 |
| 2026-09-24 |             11 |
| 2026-09-25 |              2 |
| 2026-09-30 |              7 |
| 2026-10-09 |             15 |
| 2026-10-10 |             29 |
| 2026-10-11 |             17 |
| 2026-10-12 |             15 |
| 2026-10-13 |              3 |
| 2026-10-15 |              1 |
| 2026-10-18 |              4 |
| 2026-11-02 |              2 |
| 2026-11-04 |              2 |
| **Total**  |        **122** |

The most frequently changed areas were reusable components, administrator routes, API services/controllers, API routes, resident routes, application state, and utility modules.

## 7. Complete categorized commit inventory

Every unique MarcGian commit appears exactly once below. Commits are grouped by the nature of the change and remain chronological within each group. Dates are retained for traceability. Each short SHA can be opened at `https://github.com/marcgianagnabo/haone/commit/<SHA>`.

### Category summary

| Category                           | Commits |
| ---------------------------------- | ------: |
| Foundational & Architecture        |       5 |
| Features & Functional Enhancements |      45 |
| Fixes & Reliability                |      53 |
| Documentation & Deployment         |       7 |
| UI, Styling & Assets               |       3 |
| Chores, Cleanup & Maintenance      |       5 |
| Reverts & Final-State Decisions    |       4 |
| **Total**                          | **122** |

### Foundational & Architecture (5)

Core project, backend, schema-baseline, and build foundations on which later work depends.

- `d0bbbef` · 2026-09-23 — Update Project
- `110266e` · 2026-09-23 — Add Supabase support for e-receipts and maintenance/gas fee columns
- `72f8278` · 2026-09-30 — Add a consolidated baseline migration
- `c9b488b` · 2026-10-10 — Ensure custom-route link targets exist on fresh builds
- `eca9821` · 2026-10-10 — Restore private source configuration at build time

### Features & Functional Enhancements (45)

New user-facing capabilities and meaningful extensions to existing workflows.

- `a0aa048` · 2026-09-23 — Add maintenance and gas fees
- `a2eb053` · 2026-09-23 — Add audited transaction tags and transaction filtering
- `bb26209` · 2026-09-23 — Add machine/area selection to laundry bookings
- `3139635` · 2026-09-23 — Add left/right wing machine areas with dynamic calendar connection
- `80490b5` · 2026-09-24 — Carry all fund balances to the next term
- `5371379` · 2026-09-24 — Seed academic terms, fees, and active-term constants
- `59d67b8` · 2026-09-24 — Seed payment-method constants
- `683b7af` · 2026-09-25 — Limit fund carryover to the following academic year
- `c9a4212` · 2026-09-25 — Show money-in/money-out direction on transaction types
- `351dd69` · 2026-09-30 — Color, group, and describe transaction types
- `b5f7067` · 2026-09-30 — Add guarded test-data cleanup
- `05e3109` · 2026-10-09 — Show officer photos and remove the privacy visibility toggle
- `442c38e` · 2026-10-09 — Add side-by-side officer cards, photo previews, and Facebook links
- `8e8fe6a` · 2026-10-09 — Refine officer titles, photos, preview, and committee layout
- `fb40cb5` · 2026-10-09 — Widen officer cards and simplify photo/name presentation
- `2aa64de` · 2026-10-09 — Add single sign-in with an officer workspace picker
- `e11ab8a` · 2026-10-09 — Add loading state to the push-notification toggle
- `a723ccd` · 2026-10-09 — Wire the laundry dashboard and occupancy profile photos
- `2ab9ae4` · 2026-10-09 — Standardize fixed two-hour laundry slots and admin 24-hour grid
- `0be0b56` · 2026-10-09 — Add semester carryover, remove collection periods, and add term fees
- `8e5ffd7` · 2026-10-10 — Add onboarding gate and standardized student numbers
- `c5b93bf` · 2026-10-10 — Give the instance administrator officer privilege by default
- `e4d2424` · 2026-10-10 — Email approval/decline results and remove bulk approval
- `913647c` · 2026-10-10 — Offer the phone camera in image upload controls
- `c51ca94` · 2026-10-10 — Remove Book Slot header shortcuts
- `2181da7` · 2026-10-10 — Add Search Console verification
- `c047709` · 2026-10-10 — Limit laundry booking to the current week
- `b464f39` · 2026-10-10 — Separate fridge Take Photo and Upload actions
- `7a962c7` · 2026-10-10 — Auto-center the laundry week scroller on today
- `d16ca9a` · 2026-10-10 — Add a forced resident notification prompt
- `b742976` · 2026-10-10 — Add a PWA install card and re-prompt unsubscribed users
- `a31f45b` · 2026-10-11 — Add a 15-minute inactivity timeout
- `84c8025` · 2026-10-11 — Add a mobile photo backdrop to sign-in pages
- `e9bfb4f` · 2026-10-11 — Link the NFRH Facebook page and group in onboarding
- `bd4768e` · 2026-10-11 — Add the mobile photo backdrop to the landing page
- `85f151a` · 2026-10-11 — Enforce one active laundry booking and close past days
- `ced8e96` · 2026-10-11 — Add one-trip officer sign-in and Supabase scope handling
- `fa8a31f` · 2026-10-11 — Add the October advance-booking laundry promotion
- `6e4bfae` · 2026-10-11 — Show laundry booker name and room to residents
- `224f3ee` · 2026-10-12 — Number sync cards and show pending counts
- `4dadb61` · 2026-10-12 — Add a pending count badge to Residents Sync
- `cae7bba` · 2026-10-13 — Add the “My home far away from home” front-page photo
- `67f430a` · 2026-10-18 — Replace the post-login admin check with a House Council sign-in link
- `9a7b08d` · 2026-10-18 — Gate receipt dispatch and academic terms to officers
- `51ba787` · 2026-11-04 — Add public portal administration and laundry updates

### Fixes & Reliability (53)

Corrections for broken behavior, data handling, browser compatibility, and runtime reliability.

- `2411d21` · 2026-09-23 — Resolve existing user IDs before journal inserts to avoid FK violations
- `154436d` · 2026-09-23 — Send the real resident ID on payment requests and allow self-cancellation
- `19ec9d1` · 2026-09-23 — Resolve real resident IDs for laundry and fridge under RLS
- `34c921a` · 2026-09-23 — Use real resident IDs in laundry and fridge flows
- `2ce38dd` · 2026-09-23 — Fix fridge, laundry, and Supabase migrations
- `e553b50` · 2026-09-23 — Fix the Financial Report export button
- `148d006` · 2026-09-23 — Connect onboarding registration to administrator approval
- `01b2d7f` · 2026-09-24 — Store empty announcement dates as null
- `8e18abc` · 2026-09-24 — Fix Supabase migration notifications
- `cdc0a1c` · 2026-09-24 — Add the achievements feature flag and eligible-count RPC
- `14c065a` · 2026-09-24 — Type laundry machine slot callbacks
- `6be9a04` · 2026-09-24 — Auto-link users to auth identities
- `b321cbe` · 2026-09-30 — Resolve announcement creator IDs to linked auth users
- `446cd1f` · 2026-09-30 — Show fee magnitudes and cap refunds at amounts collected
- `816bddd` · 2026-09-30 — Show the real remaining collection-refund balance
- `11934e3` · 2026-10-09 — Normalize relative branding logo URLs
- `4b1b746` · 2026-10-09 — Reset header scroll state during navigation
- `c0a8887` · 2026-10-09 — Match bulk resident selection by account ID
- `5723f62` · 2026-10-10 — Fix the student-number backfill regex
- `621b242` · 2026-10-10 — Fix term fee upsert and seed term fees
- `a5268cc` · 2026-10-10 — Preserve resident access after declined registration
- `8214b4a` · 2026-10-10 — Prevent invalid resubmission of declined registrations
- `17a81e5` · 2026-10-10 — Clear sent dispatcher items and prevent resend on retry
- `182c20d` · 2026-10-10 — Hide native number-input spinners
- `f288378` · 2026-10-10 — Ignore Wrangler configuration and OAuth client JSON
- `a837da3` · 2026-10-10 — Add Supabase-native public clearance verification
- `acfe9bb` · 2026-10-10 — Pin mobile app header and reduce small-screen typography
- `e948905` · 2026-10-10 — Improve reliability of today-centering
- `2fffc75` · 2026-10-10 — Pin mobile bottom navigation and handle safe areas
- `55352bc` · 2026-10-10 — Correct sticky logo/title/current-time stacking
- `200f8d0` · 2026-10-10 — Add the missing PWA-install state store
- `f278380` · 2026-10-11 — Revise resident-sync approval email wording
- `e11ab35` · 2026-10-11 — Offset the app header below the PWA install banner
- `26698ff` · 2026-10-11 — Improve the sign-in header/photo bar and remove dead PWA offset logic
- `21b47bf` · 2026-10-11 — Fix notification prompt overflow
- `6f2d6e8` · 2026-10-11 — Finalize a 10-minute inactivity timeout
- `b11b251` · 2026-10-11 — Split dorm/misc payments and enforce misc-only Others entries
- `dc15d02` · 2026-10-11 — Add Fridge to mobile navigation
- `c93bbd2` · 2026-10-11 — Match announcement formatting on the resident dashboard
- `3938e0b` · 2026-10-12 — Harden OAuth callbacks for iOS Safari and in-app browsers
- `d6abfda` · 2026-10-12 — Add full-page post-login navigation and auth diagnostics
- `da3212e` · 2026-10-12 — Persist workspace-picker handoff across reloads
- `b6dceb0` · 2026-10-12 — Add error beacon, post-auth navigation, and chunk recovery
- `ca0ac68` · 2026-10-12 — Add auth-failure trails and visible error reports
- `411157b` · 2026-10-12 — Guard background sync and capture raw errors
- `352e756` · 2026-10-12 — Prevent error-boundary loops and redirect races on iOS
- `417d134` · 2026-10-12 — Preserve blank lines in announcements
- `85fc085` · 2026-10-12 — Correct the open week for the laundry promotion
- `27b94de` · 2026-10-12 — Promote advance-booking guidance in laundry rules
- `8360a7f` · 2026-10-13 — Improve push retry, VAPID compatibility, and dismissal handling
- `24e2e4f` · 2026-10-15 — Remove `user_metadata` from registration RLS and identity checks
- `3f2ecd6` · 2026-10-18 — Force a dark mobile onboarding palette over the photo backdrop
- `2bd613a` · 2026-11-04 — Optimize portal hero images for social previews

### Documentation & Deployment (7)

Setup, migration, incident, deployment, and operational guidance.

- `8cd3953` · 2026-09-24 — Add the Supabase migration guide
- `4579e59` · 2026-09-24 — Document auth identity linkage and onboarding lockout prevention
- `b42164b` · 2026-09-30 — Add setup and deployment instructions
- `e42e023` · 2026-10-10 — Document instance-administrator privilege setup
- `8b5391f` · 2026-10-12 — Document the iPhone post-sign-in incident
- `a4bcc2f` · 2026-10-12 — Close the iPhone incident documentation
- `8026ffe` · 2026-10-12 — Shorten the one-active-booking rule text

### UI, Styling & Assets (3)

Visual presentation, layout, branding, imagery, and interface-only adjustments.

- `3acdb46` · 2026-10-09 — Update NFRH logos
- `2a7f276` · 2026-10-10 — Revise NFRH logos and add a hero photo
- `4c31718` · 2026-10-13 — Style mobile ingress cards and onboarding backdrop

### Chores, Cleanup & Maintenance (5)

Repository housekeeping, removals, configuration cleanup, and non-functional maintenance.

- `307d317` · 2026-09-23 — Clean up onboarding registration, DB Sync settings, and formatting
- `c63b0f5` · 2026-09-24 — Remove the private-assets symlink
- `3b269c0` · 2026-10-09 — Remove Database Sync from navigation while retaining the route
- `7303224` · 2026-10-09 — Remove the workspace hint from the sign-in page
- `e3381f4` · 2026-10-10 — Remove unused branding images

### Reverts & Final-State Decisions (4)

Changes that intentionally reversed earlier work and define the resulting branch behavior.

- `45afe3c` · 2026-10-11 — Revert one-trip login while retaining Sheets scope gating
- `50ba6d3` · 2026-10-18 — Revert the receipt/academic-term officer gate
- `a29f20e` · 2026-11-02 — Restore the post-login workspace picker for officers
- `5a859a9` · 2026-11-02 — Return transaction carryover to the manual transaction flow

## 8. References

- [MarcGian HAOne repository](https://github.com/marcgianagnabo/haone)
- [Upstream HAOne repository](https://github.com/fofajardo/haone)
- [Public portal integration](PUBLIC_PORTAL_INTEGRATION.md)
- [Setup and deployment instructions](NEW_SETUP_DEPLOYMENT_INSTRUCTIONS.md)
- [Database migration guide](../migrations/README.md)
- [Production bug ledger](BUG_LEDGER.md)

---

_Prepared from the repository state available on November 7, 2026. Commit dates use the timestamps recorded by GitHub._
