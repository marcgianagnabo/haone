<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Download, Share, X } from "@lucide/svelte";
  import { pwaInstall } from "$state/pwa-install.svelte";

  async function handleInstall() {
    await pwaInstall.install();
  }
</script>

{#if pwaInstall.shouldShowBanner}
  <Card.Root>
    <Card.Header class="pb-2">
      <div class="flex items-center gap-3">
        <img
          src="/icon-192x192.png"
          alt="HAOne logo"
          class="h-10 w-10 shrink-0 rounded-md object-contain"
        />
        <div class="min-w-0 flex-1">
          <Card.Title class="text-base">Get the HAOne app</Card.Title>
          <Card.Description>Install for quick access and notifications.</Card.Description>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 shrink-0"
          onclick={() => pwaInstall.dismiss()}
          aria-label="Dismiss install card"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </Card.Header>
    <Card.Content class="space-y-3">
      <Button class="w-full" icon={Download} onclick={handleInstall}>
        {pwaInstall.canPrompt ? "Install" : "How to install"}
      </Button>
      {#if pwaInstall.showInstructions}
        <div class="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white"
          >
            <Share class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-semibold text-foreground">Install HAOne on your device</p>
            {#if pwaInstall.isIos}
              <ol class="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>
                  Tap <span class="font-semibold text-foreground">Share</span> in Safari's toolbar.
                </li>
                <li>
                  Tap <span class="font-semibold text-foreground">Add to Home Screen</span>, then
                  <span class="font-semibold text-foreground">Add</span>.
                </li>
              </ol>
            {:else}
              <p class="mt-1 text-xs text-muted-foreground">
                Open your browser menu and choose
                <span class="font-semibold text-foreground">Install app</span> or
                <span class="font-semibold text-foreground">Add to Home Screen</span>.
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
