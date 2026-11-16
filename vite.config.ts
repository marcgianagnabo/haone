import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "child_process";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

const commitSha = execSync("git rev-parse --short HEAD").toString().trim();
const appVersion = pkg.version;

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  build: {
    // Keep emitted client syntax compatible with older iOS WebKit versions.
    // Vite's rolling "widely available" baseline can advance independently
    // of iOS updates, while Chrome on iPhone is still backed by WebKit.
    target: "es2020"
  },
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_SUFFIX__: JSON.stringify(
      appVersion.includes("b") ? "Beta" : appVersion.includes("a") ? "Alpha" : ""
    ),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  ssr: {
    noExternal: ["layerchart", "svelte-sonner"]
  }
});
