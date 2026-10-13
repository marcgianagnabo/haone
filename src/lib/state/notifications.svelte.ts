import { deletePushSubscription, savePushSubscription } from "$api/controllers/settings-controller";
import { browser } from "$app/environment";
import { toast } from "svelte-sonner";

export const NOTIF_PROMPT_DISMISSED_KEY = "halsk.notif.prompt_dismissed_at";

/** Brave/Firefox require the VAPID key as a Uint8Array; Chrome tolerates a string. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

class NotificationManager {
  #subscription = $state<PushSubscription | null>(null);
  #permission = $state<NotificationPermission>("default");
  #isSupported = $state(false);
  #isChecking = $state(true);
  #isBusy = $state(false);

  constructor() {
    if (browser) {
      this.#isSupported =
        "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      this.#permission = Notification.permission;
      this.#checkCurrentSubscription();
    } else {
      this.#isChecking = false;
    }
  }

  async #checkCurrentSubscription() {
    try {
      if (!this.#isSupported) return;
      const registration = await navigator.serviceWorker.ready;
      this.#subscription = await registration.pushManager.getSubscription();
    } finally {
      this.#isChecking = false;
    }
  }

  get isSupported() {
    return this.#isSupported;
  }
  get permission() {
    return this.#permission;
  }
  get isSubscribed() {
    return !!this.#subscription;
  }
  get isChecking() {
    return this.#isChecking;
  }
  get isBusy() {
    return this.#isBusy;
  }

  /** Re-read the live browser permission (user may have changed it in site settings). */
  refreshStatus() {
    if (!browser || !this.#isSupported) return;
    try {
      this.#permission = Notification.permission;
    } catch {
      /* noop */
    }
  }

  async requestPermission() {
    if (!this.#isSupported) return false;
    this.refreshStatus();
    const result = await Notification.requestPermission();
    this.#permission = result;
    return result === "granted";
  }

  async subscribe(vapidPublicKey: string) {
    if (!this.#isSupported || this.#isBusy) return false;

    this.refreshStatus();
    if (this.#permission === "denied") {
      toast.error("Notification permission denied");
      return false;
    }

    this.#isBusy = true;
    let subscription: PushSubscription | null = null;
    try {
      const registration = await navigator.serviceWorker.ready;

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await savePushSubscription(subscription);
      this.#subscription = subscription;
      toast.success("Notifications enabled");
      return true;
    } catch (e: any) {
      const name = e?.name || "Error";
      const message = e?.message || String(e);
      console.error(`Subscription failed (${name}):`, message);
      if (name === "NotAllowedError") {
        this.refreshStatus();
        toast.error("Browser blocked the prompt — click Allow again to retry");
      } else if (name === "InvalidAccessError" || name === "AbortError") {
        toast.error("This browser rejected the push setup (VAPID/key). Try again.");
      } else if (name === "NetworkError" || /network|fetch|failed/i.test(message)) {
        toast.error("Network issue while enabling notifications. Try again.");
      } else {
        toast.error("Failed to enable notifications");
      }
      // Avoid orphan endpoints: server save failed after a local subscribe.
      try {
        await subscription?.unsubscribe();
      } catch {
        /* best-effort cleanup */
      }
      return false;
    } finally {
      this.#isBusy = false;
    }
  }

  async unsubscribe() {
    if (!this.#subscription || this.#isBusy) return;

    this.#isBusy = true;
    try {
      await deletePushSubscription(this.#subscription.endpoint);
      await this.#subscription.unsubscribe();
      this.#subscription = null;
      toast.success("Notifications disabled");
    } catch (e: any) {
      console.error("Unsubscription failed:", e);
      toast.error("Failed to disable notifications");
    } finally {
      this.#isBusy = false;
    }
  }
}

export const notifications = new NotificationManager();
