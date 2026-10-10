#!/usr/bin/env node
/**
 * HAOne — bundle private data for Cloudflare builds
 * =============================================================================
 * Packs the three build-required src-private files into a single base64
 * string for the SRC_PRIVATE_BUNDLE encrypted Pages variable, so git-based
 * Cloudflare builds can restore the REAL private data (never the sample
 * fallback) without committing it.
 *
 * Only these files are bundled (the build's static imports). Route dirs and
 * assets are NOT included: empty route dirs are created by
 * scripts/restore-src-private.mjs, and branding artwork is served from
 * static/ or hosted URLs.
 *
 * USAGE
 * -----------------------------------------------------------------------------
 *   node scripts/bundle-src-private.mjs                 # prints bundle to stdout
 *   node scripts/bundle-src-private.mjs --out <file>    # writes bundle to file
 *
 * Regenerate + repaste the Pages variable whenever branding.json, rooms.json
 * or services.ts change. The bundle contains hall emails/room layout (mildly
 * sensitive: treat like a secret, never commit it, never paste it in chat).
 */

import { readFileSync, writeFileSync } from "node:fs";

const FILES = ["branding.json", "rooms.json", "services.ts"];

const outFlag = process.argv.indexOf("--out");
const outFile = outFlag === -1 ? null : process.argv[outFlag + 1];

const payload = {};
for (const name of FILES) {
  payload[name] = readFileSync(new URL(`../src-private/${name}`, import.meta.url), "utf8");
}

const bundle = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

if (outFile) {
  writeFileSync(outFile, bundle + "\n");
  console.log(`wrote ${bundle.length} chars to ${outFile}`);
} else {
  process.stdout.write(bundle + "\n");
}
