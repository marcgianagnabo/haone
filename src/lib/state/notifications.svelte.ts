import { deletePushSubscription, savePushSubscription } from "$api/controllers/settings-controller";
import { browser } from "$app/environment";
import { toast } from "svelte-sonner";

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

  async requestPermission() {
    if (!this.#isSupported) return false;
    const result = await Notification.requestPermission();
    this.#permission = result;
    return result === "granted";
  }

  async subscribe(vapidPublicKey: string) {
    if (!this.#isSupported || this.#isBusy) return;

    this.#isBusy = true;
    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      await savePushSubscription(subscription);
      this.#subscription = subscription;
      toast.success("Notifications enabled");
    } catch (e: any) {
      console.error("Subscription failed:", e);
      toast.error("Failed to enable notifications");
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
