export const OUTBOX_SYNC_TAG = 'samen-thuis-outbox-sync';
export const PERIODIC_SYNC_TAG = 'samen-thuis-periodic-sync';
export const PERIODIC_SYNC_INTERVAL = 15 * 60 * 1000;

export async function registerOneOffSync(registration) {
  if (!registration?.sync?.register) return false;
  await registration.sync.register(OUTBOX_SYNC_TAG);
  return true;
}

export async function registerPeriodicSync(registration) {
  if (!registration?.periodicSync?.register) return false;
  await registration.periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: PERIODIC_SYNC_INTERVAL });
  return true;
}

export async function unregisterPeriodicSync(registration) {
  if (!registration?.periodicSync?.unregister) return false;
  await registration.periodicSync.unregister(PERIODIC_SYNC_TAG);
  return true;
}

export class BackgroundSyncService {
  constructor({ auth, family, sync, outbox }) {
    this.auth = auth;
    this.family = family;
    this.sync = sync;
    this.outbox = outbox;
    this.registration = null;
    this.started = false;
    this.localChangeHandler = () => this.schedule('lokale wijziging').catch(() => {});
    this.messageHandler = (event) => this.#handleWorkerMessage(event);
  }

  get eligible() { return Boolean(this.auth.isSignedIn && this.family.context); }

  async start(registration) {
    if (!registration || this.started) return this.status();
    this.registration = registration;
    this.started = true;
    globalThis.addEventListener?.('samen-thuis-local-change', this.localChangeHandler);
    navigator.serviceWorker?.addEventListener('message', this.messageHandler);
    await this.refresh();
    return this.status();
  }

  async refresh() {
    if (!this.registration) return false;
    if (!this.eligible) {
      await unregisterPeriodicSync(this.registration).catch(() => false);
      return false;
    }
    await registerPeriodicSync(this.registration).catch(() => false);
    if ((await this.outbox.getPendingChanges()).length) await this.schedule('wachtende wijzigingen');
    return true;
  }

  async schedule(reason = 'automatisch') {
    if (!this.registration || !this.eligible) return false;
    const registered = await registerOneOffSync(this.registration).catch(() => false);
    if (!registered && navigator.onLine) this.sync.schedule(reason, 200);
    return registered;
  }

  async disable() {
    if (!this.registration) return false;
    return unregisterPeriodicSync(this.registration).catch(() => false);
  }

  async status() {
    const registration = this.registration;
    const oneOffSupported = Boolean(registration?.sync?.register);
    const periodicSupported = Boolean(registration?.periodicSync?.register);
    let oneOffRegistered = false;
    let periodicRegistered = false;
    if (oneOffSupported && registration.sync.getTags) {
      oneOffRegistered = (await registration.sync.getTags().catch(() => [])).includes(OUTBOX_SYNC_TAG);
    }
    if (periodicSupported && registration.periodicSync.getTags) {
      periodicRegistered = (await registration.periodicSync.getTags().catch(() => [])).includes(PERIODIC_SYNC_TAG);
    }
    return { oneOffSupported, periodicSupported, oneOffRegistered, periodicRegistered, eligible: this.eligible };
  }

  #handleWorkerMessage(event) {
    if (event.data?.type !== 'SAMEN_THUIS_BACKGROUND_SYNC') return;
    this.auth.reloadFromStorage()
      .then(() => this.sync.acceptBackgroundResult(event.data))
      .catch(() => {});
  }
}
