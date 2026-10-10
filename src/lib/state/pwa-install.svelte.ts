import { browser } from "$app/environment";
import { LS_KEYS } from "$lib/constants";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function detectInstalled(): boolean {
  if (!browser) return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    // iOS Safari
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
    if (localStorage.getItem(LS_KEYS.PWA_INSTALLED) === "1") return true;
  } catch {
    // ignore
  }
  return false;
}

function detectIos(): boolean {
  if (!browser) return false;
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isDismissed(): boolean {
  if (!browser) return false;
  try {
    const raw = localStorage.getItem(LS_KEYS.PWA_BANNER_DISMISSED_AT);
    if (!raw) return false;
    const at = Number(raw);
    if (Number.isNaN(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

class PwaInstallStore {
  deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  isInstalled = $state(false);
  isIos = $state(false);
  dismissed = $state(false);
  initialized = $state(false);
  showInstructions = $state(false);
  private listenersAttached = false;

  get canPrompt(): boolean {
    return this.deferredPrompt !== null;
  }

  get shouldShowBanner(): boolean {
    return this.initialized && !this.isInstalled && !this.dismissed;
  }

  init() {
    if (!browser || this.listenersAttached) return;
    this.listenersAttached = true;
    this.isInstalled = detectInstalled();
    this.isIos = detectIos();
    this.dismissed = isDismissed();
    this.initialized = true;

    window.addEventListener("beforeinstallprompt", (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
    });

    window.addEventListener("appinstalled", () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.showInstructions = false;
      try {
        localStorage.setItem(LS_KEYS.PWA_INSTALLED, "1");
      } catch {
        // ignore
      }
    });
  }

  async install(): Promise<void> {
    if (!browser) return;
    if (this.deferredPrompt) {
      try {
        await this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          this.isInstalled = true;
          try {
            localStorage.setItem(LS_KEYS.PWA_INSTALLED, "1");
          } catch {
            // ignore
          }
        }
      } catch {
        // prompt failed — fall through to instructions on iOS
        if (this.isIos) this.showInstructions = true;
      } finally {
        this.deferredPrompt = null;
      }
      return;
    }
    // No native prompt (iOS Safari / Firefox): show manual steps.
    this.showInstructions = true;
  }

  dismiss() {
    this.dismissed = true;
    this.showInstructions = false;
    try {
      localStorage.setItem(LS_KEYS.PWA_BANNER_DISMISSED_AT, String(Date.now()));
    } catch {
      // ignore
    }
  }

  toggleInstructions() {
    this.showInstructions = !this.showInstructions;
  }
}

export const pwaInstall = new PwaInstallStore();
