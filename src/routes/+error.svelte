<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "$ui/button";
  import {
    ChevronRight,
    RefreshCcw,
    House,
    MapPinOff,
    Lock,
    ShieldAlert,
    Zap,
    CircleAlert,
    Construction
  } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import { cn } from "$lib/utils";
  import { toast } from "svelte-sonner";
  import HeroLayout from "$components/branding/HeroLayout.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { readAuthTrail } from "$utils/auth-trail";

  let showDetails = $state(false);

  const status = page.status;
  const error = page.error as { message: string; stack?: string };

  const errorTitles: Record<number, string> = {
    404: "These aren't the droids you're looking for",
    401: "Stay on target… (Auth Denied)",
    403: "You lack the Force (Access Forbidden)",
    500: "A great disturbance in the Force",
    503: "The hyperdrive is leaking"
  };

  const errorIcons: Record<number, any> = {
    404: MapPinOff,
    401: Lock,
    403: ShieldAlert,
    500: Zap,
    503: Construction
  };

  const errorDescriptions: Record<number, string> = {
    404: "The coordinates you provided lead to a void in space-time. Perhaps the archives are incomplete?",
    401: "Your clearance codes have expired or are invalid. Please re-authenticate.",
    403: "This sector is restricted. You do not have the required clearance level.",
    500: "A critical failure has occurred in the reactor core. Our droids are working on it.",
    503: "The system is currently undergoing tactical maintenance. Check back soon."
  };

  const title = errorTitles[status] || `Something went wrong (${status || 500})`;
  const Icon = errorIcons[status] || CircleAlert;
  const description =
    errorDescriptions[status] || error?.message || "Internal server error occurred.";

  // Screenshot-friendly report: visible as plain text so a Messenger-
  // forwarded screenshot alone carries the diagnosis (no Copy tap, no logs).
  const reportTime = new Date().toISOString();
  const reportBuild = `v${__APP_VERSION__} (${__COMMIT_SHA__.slice(0, 7)})`;
  const reportTrail = readAuthTrail();
  const reportPath = page.url.pathname;

  // Raw pre-sanitized capture from the root layout listeners (may hold the
  // true message/stack when the boundary shows a generic 500). Read once at
  // init — never reassigned, so plain const is correct (no $state needed).
  const rawCapture: { kind: string; message: string; stack: string } = (() => {
    try {
      const raw = localStorage.getItem("halsk.last_raw_error");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          kind: ((parsed.kind || "") as string).slice(0, 40),
          message: ((parsed.message || "") as string).slice(0, 500),
          stack: ((parsed.stack || "") as string).slice(0, 2000)
        };
      }
    } catch {
      /* diagnostics are best-effort */
    }
    return { kind: "", message: "", stack: "" };
  })();
  const rawKind = rawCapture.kind;
  const rawMessage = rawCapture.message;
  const rawStack = rawCapture.stack;

  function buildReport() {
    // Pathname only — never the query string (it may hold single-use OAuth codes).
    return (
      `Status: ${status}\n` +
      `Message: ${error?.message}\n` +
      `Stack: ${error?.stack}\n` +
      `Raw: [${rawKind}] ${rawMessage}\n` +
      `Raw stack: ${rawStack}\n` +
      `Path: ${reportPath}\n` +
      `Time: ${reportTime}\n` +
      `Build: ${reportBuild}\n` +
      `Auth trail: ${reportTrail}`
    );
  }

  onMount(() => {
    pageState.title = `${status || 500} - ${title}`;
    // Persist the last error locally so /sign-in can surface it even after
    // the user navigates away from this page.
    try {
      localStorage.setItem(
        "halsk.last_error",
        JSON.stringify({
          status: status || 0,
          message: error?.message || "",
          raw: rawKind || rawMessage ? `[${rawKind}] ${rawMessage}`.slice(0, 300) : "",
          path: reportPath,
          time: reportTime,
          build: reportBuild,
          trail: reportTrail
        })
      );
    } catch {
      /* diagnostics are best-effort */
    }
    // One-shot client error beacon (keepalive: survives page close). PII-free:
    // pathname only, never the query string (it may hold OAuth codes).
    try {
      const payload = JSON.stringify({
        status: status || 0,
        path: page.url.pathname,
        build: `v${__APP_VERSION__} (${__COMMIT_SHA__.slice(0, 7)})`,
        trail: readAuthTrail()
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/client-log",
          new Blob([payload], { type: "application/json" })
        );
      } else {
        fetch("/api/client-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch {
      /* diagnostics are best-effort */
    }
  });

  function reload() {
    // Never replay a dead OAuth callback: a retried ?code= is already
    // consumed (invalid_grant), so strip it before reloading.
    try {
      if (page.url.pathname === "/sign-in") {
        window.history.replaceState({}, "", "/sign-in");
      }
    } catch {
      /* noop */
    }
    window.location.reload();
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(buildReport());
    toast.success("Error details copied to clipboard");
  }
</script>

<HeroLayout heroId="error01" contentClass="max-w-md">
  <div class="flex flex-col space-y-4 text-center md:text-left">
    <div class="space-y-3">
      <div
        class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive md:mx-0"
      >
        <Icon class="h-6 w-6" />
      </div>
      <h1 class="font-['Archivo'] text-3xl font-black tracking-tighter text-foreground sm:text-4xl">
        {title}
      </h1>
      <p class="text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  </div>

  {#if error?.stack}
    <div class="space-y-2">
      <button
        onclick={() => (showDetails = !showDetails)}
        class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
      >
        <span class="flex items-center gap-2 tracking-wider uppercase"> Technical Details </span>
        <ChevronRight
          size={14}
          class={cn("transition-transform duration-200", showDetails ? "rotate-90" : "")}
        />
      </button>

      {#if showDetails}
        <div
          transition:slide
          class="overflow-hidden rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"
        >
          <div class="max-h-50 overflow-auto font-mono whitespace-pre">
            {error.stack}
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="mt-2 h-7 w-full text-xs tracking-widest uppercase"
            onclick={copyToClipboard}
          >
            Copy
          </Button>
        </div>
      {/if}
    </div>
  {/if}

  {#if !error?.stack}
    <div class="space-y-2">
      <div
        class="overflow-hidden rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"
      >
        <div class="max-h-50 space-y-1 overflow-auto font-mono break-all whitespace-pre-wrap">
          <div>Status: {status}</div>
          <div>Path: {reportPath}</div>
          <div>Time: {reportTime}</div>
          <div>Build: {reportBuild}</div>
          {#if rawMessage}
            <div>Raw: [{rawKind}] {rawMessage}</div>
          {/if}
          <div>Auth trail: {reportTrail}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="mt-2 h-7 w-full text-xs tracking-widest uppercase"
          onclick={copyToClipboard}
        >
          Copy
        </Button>
      </div>
    </div>
  {/if}

  <div class="grid gap-3">
    <Button
      onclick={reload}
      class="h-14 rounded-xl bg-foreground text-base font-bold text-background transition-all hover:opacity-90 active:scale-[0.98]"
      icon={RefreshCcw}
    >
      Retry
    </Button>
    <Button
      variant="secondary"
      href="/"
      class="h-12 rounded-xl text-sm font-semibold text-muted-foreground transition-all hover:text-foreground"
      icon={House}
    >
      Go Home
    </Button>
  </div>

  <div
    class="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground md:justify-start"
  >
    <code class="font-mono">
      v{__APP_VERSION__} ({__COMMIT_SHA__.slice(0, 7)} - {new Date(
        __BUILD_TIME__
      ).toLocaleString()})
    </code>
  </div>
</HeroLayout>
