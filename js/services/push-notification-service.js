export function pushSupported() {
  return 'Notification' in globalThis && 'serviceWorker' in navigator && 'PushManager' in globalThis;
}

export function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function subscriptionPayload(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime || null,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth }
  };
}

export class PushNotificationService {
  constructor(client, auth, family) {
    this.client = client;
    this.auth = auth;
    this.family = family;
  }

  async status() {
    if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false };
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return { supported: true, permission: Notification.permission, subscribed: Boolean(subscription) };
  }

  async enable() {
    if (!pushSupported()) throw new Error('Web Push wordt op dit apparaat niet ondersteund. In-app herinneringen blijven werken.');
    if (!this.auth.isSignedIn || !this.family.context) throw new Error('Log eerst in en koppel een gezin om meldingen buiten de app te ontvangen.');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Geef toestemming voor notificaties om pushmeldingen in te schakelen.');
    if (!navigator.onLine) throw new Error('Voor het inschakelen van pushmeldingen is een internetverbinding nodig.');

    const token = await this.auth.getAccessToken();
    const config = await this.client.invokeFunction('send-reminders', { action: 'config' }, token);
    if (!config?.publicKey) throw new Error('De pushdienst gaf geen geldige openbare sleutel terug.');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
      });
    }
    await this.#save(subscription, token);
    return { subscribed: true };
  }

  async refreshExisting() {
    if (!pushSupported() || Notification.permission !== 'granted' || !this.auth.isSignedIn || !this.family.context || !navigator.onLine) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;
    await this.#save(subscription, await this.auth.getAccessToken());
    return true;
  }

  async disable() {
    if (!pushSupported()) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;
    if (this.auth.isSignedIn && navigator.onLine) {
      const token = await this.auth.getAccessToken();
      await this.client.invokeFunction('send-reminders', { action: 'unsubscribe', endpoint: subscription.endpoint }, token).catch(() => {});
    }
    await subscription.unsubscribe();
    return true;
  }

  async #save(subscription, token) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';
    await this.client.invokeFunction('send-reminders', {
      action: 'subscribe', subscription: subscriptionPayload(subscription), timezone
    }, token);
  }
}
