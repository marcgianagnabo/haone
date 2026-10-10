#!/usr/bin/env node
/**
 * HAOne — restore private data for builds (prebuild)
 * =============================================================================
 * Runs automatically before `vite build` (package.json `prebuild`), locally
 * and on Cloudflare. Two jobs:
 *
 *   1. Create the empty src-private/routes/* dirs so the (custom) symlinks
 *      in src/routes always resolve (real custom routes load when present).
 *   2. Restore any MISSING build-required src-private file
 *      (branding.json, rooms.json, services.ts) from the SRC_PRIVATE_BUNDLE
 *      encrypted Pages variable. Files already on disk are NEVER overwritten.
 *
 * There is deliberately NO sample-data fallback: if files are missing and no
 * bundle is set, the build FAILS LOUDLY instead of silently shipping sample
 * branding. Set SRC_PRIVATE_BUNDLE (see scripts/bundle-src-private.mjs) or
 * place real files in src-private/.
 */

import { accessSync, mkdirSync, writeFileSync } from "node:fs";

const DIRS = ["src-private/routes/admin", "src-private/routes/api", "src-private/routes/resident"];
const FILES = ["branding.json", "rooms.json", "services.ts"];

for (const d of DIRS) {
  mkdirSync(d, { recursive: true });
}

const missing = FILES.filter((f) => {
  try {
    accessSync(`src-private/${f}`);
    return false;
  } catch {
    return true;
  }
});

if (missing.length === 0) {
  process.exit(0);
}

const bundle = (process.env.SRC_PRIVATE_BUNDLE || "").trim();
if (!bundle) {
  console.error(
    `[restore-src-private] MISSING: ${missing.join(", ")}. ` +
      `Set the SRC_PRIVATE_BUNDLE encrypted variable (see scripts/bundle-src-private.mjs) ` +
      `or place real files in src-private/. Refusing to build with sample branding.`
  );
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(Buffer.from(bundle, "base64").toString("utf8"));
} catch {
  console.error("[restore-src-private] SRC_PRIVATE_BUNDLE is not valid base64 JSON.");
  process.exit(1);
}

for (const f of missing) {
  if (typeof payload[f] !== "string") {
    console.error(`[restore-src-private] bundle lacks ${f}; refusing sample fallback.`);
    process.exit(1);
  }
  writeFileSync(`src-private/${f}`, payload[f]);
}
console.log(`[restore-src-private] restored: ${missing.join(", ")}`);
