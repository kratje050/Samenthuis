const ENTITY_ALIASES = Object.freeze({
  appointment: 'appointment', appointments: 'appointment',
  shopping: 'shopping',
  task: 'task', tasks: 'task',
  meal: 'meal', meals: 'meal',
  inventory: 'inventory',
  expense: 'expense', expenses: 'expense',
  pet: 'pet', pets: 'pet',
  outing: 'outing', outings: 'outing',
  settings: 'settings', activity: 'activity', activities: 'activity', template: 'template', templates: 'template'
});

function newestByRecord(items) {
  const latest = new Map();
  for (const item of items) {
    const canonical = ENTITY_ALIASES[item.entityType];
    if (!canonical) continue;
    const key = `${canonical}:${item.recordId}`;
    const current = latest.get(key);
    if (!current || Number(item.version || 0) > Number(current.version || 0) || (Number(item.version || 0) === Number(current.version || 0) && String(item.changedAt) > String(current.changedAt))) latest.set(key, { ...item, canonical });
  }
  return [...latest.values()];
}

export class SyncService {
  constructor({ client, auth, family, repositories, cloudRepository, onStateChange = () => {}, onDataChange = () => {} }) {
    this.client = client;
    this.auth = auth;
    this.family = family;
    this.repositories = repositories;
    this.cloudRepository = cloudRepository;
    this.onStateChange = onStateChange;
    this.onDataChange = onDataChange;
    this.running = null;
    this.timer = null;
    this.pollTimer = null;
    this.realtimeConnected = false;
    this.queuedReason = null;
    this.started = false;
    this.state = { status: 'local', lastSyncAt: null, pending: 0, conflicts: 0, error: null };
    this.repositoryByEntity = {
      appointment: repositories.appointments, shopping: repositories.shopping, task: repositories.tasks,
      meal: repositories.meals, inventory: repositories.inventory, expense: repositories.expenses,
      pet: repositories.pets, outing: repositories.outings, settings: repositories.settings,
      activity: repositories.activity, template: repositories.templates
    };
  }

  async start() {
    if (this.started) return;
    this.started = true;
    const saved = await this.cloudRepository.get('sync-state');
    if (saved) this.#setState({ ...this.state, ...saved, status: this.family.context ? 'idle' : 'local', error: null });
    addEventListener('online', () => this.schedule('internet hersteld', 200));
    addEventListener('samen-thuis-local-change', () => this.schedule('lokale wijziging', 120));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.schedule('app op voorgrond', 200); });
    addEventListener('focus', () => this.schedule('app actief', 200));
    addEventListener('pageshow', () => this.schedule('pagina hervat', 200));
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.realtimeConnected) this.schedule('controle zonder liveverbinding', 100);
    }, 10 * 1000);
    if (this.family.context) this.schedule('app geopend', 100);
    await this.#updatePending();
  }

  schedule(reason = 'automatisch', delay = 800) {
    if (!this.auth.isSignedIn || !this.family.context || !navigator.onLine) return;
    if (this.running) {
      this.queuedReason = reason;
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync({ reason }).catch(() => {}), delay);
  }

  setRealtimeConnected(connected) {
    const changed = this.realtimeConnected !== Boolean(connected);
    this.realtimeConnected = Boolean(connected);
    if (changed && !this.realtimeConnected && document.visibilityState === 'visible') this.schedule('terugval zonder liveverbinding', 200);
  }

  async sync({ reason = 'handmatig', throwOnError = false } = {}) {
    if (this.running) return this.running;
    if (!this.auth.isSignedIn || !this.family.context) throw new Error('Log in en koppel eerst een gezin.');
    if (!navigator.onLine) throw new Error('Je bent offline. Wijzigingen worden later automatisch gesynchroniseerd.');
    const run = () => this.#run(reason);
    const operation = navigator.locks?.request
      ? navigator.locks.request('samen-thuis-cloud-sync', { mode: 'exclusive' }, run)
      : run();
    this.running = operation.catch((error) => {
      this.#setState({ status: 'error', error: error.message });
      if (throwOnError) throw error;
      return { ok: false, error };
    }).finally(() => {
      this.running = null;
      if (this.queuedReason) {
        const queuedReason = this.queuedReason;
        this.queuedReason = null;
        this.schedule(queuedReason, 40);
      }
    });
    return this.running;
  }

  async acceptBackgroundResult(message = {}) {
    const saved = await this.cloudRepository.get('sync-state');
    if (saved) this.#setState({ ...this.state, ...saved });
    await this.#updatePending();
    if (message.ok !== false) await this.onDataChange({ applied: Number(message.pulled || 0), background: true });
    return this.state;
  }

  async initializeFamily(mode) {
    if (mode === 'join') await this.pull();
    await this.queueAllLocalRecords({ includeSynced: mode !== 'join' });
    return this.sync({ reason: mode === 'create' ? 'gezin aangemaakt' : 'gezin gekoppeld', throwOnError: true });
  }

  async queueAllLocalRecords({ includeSynced = true } = {}) {
    const pending = await this.repositories.outbox.getPendingChanges();
    const queued = new Set(pending.map((item) => `${ENTITY_ALIASES[item.entityType] || item.entityType}:${item.recordId}:${item.version}`));
    for (const [entityType, repository] of Object.entries(this.repositoryByEntity)) {
      const records = await repository.getAll({ includeDeleted: true });
      for (const record of records) {
        if (!includeSynced && record.syncStatus === 'synced') continue;
        const key = `${entityType}:${record.id}:${record.version}`;
        if (!queued.has(key)) await this.repositories.outbox.queue(entityType, record, record.deletedAt ? 'delete' : 'update');
      }
    }
    await this.#updatePending();
  }

  async push() {
    const token = await this.auth.getAccessToken();
    const changes = newestByRecord(await this.repositories.outbox.getPendingChanges());
    let conflicts = 0;
    for (const change of changes) {
      const payload = { ...change.payload, syncStatus: 'synced' };
      const result = await this.client.rpc('sync_family_record', {
        p_entity_type: change.canonical,
        p_record_id: change.recordId,
        p_payload: payload,
        p_version: Number(change.version || 1),
        p_updated_at: change.changedAt,
        p_deleted_at: payload.deletedAt || null,
        p_device_id: change.deviceId || payload.deviceId || 'unknown'
      }, token);
      const response = Array.isArray(result) ? result[0] : result;
      const remote = response?.payload ? {
        ...response.payload,
        id: response.record_id || response.payload.id,
        version: Number(response.version || response.payload.version || 1),
        updatedAt: response.updated_at || response.payload.updatedAt,
        deletedAt: response.deleted_at ?? response.payload.deletedAt ?? null,
        deviceId: response.device_id || response.payload.deviceId
      } : payload;
      if (response?.conflict) conflicts += 1;
      await this.repositoryByEntity[change.canonical].markSynced(change.recordId, remote, { conflict: Boolean(response?.conflict) });
      await this.repositories.outbox.markRecordProcessed(change.entityType, change.recordId, Number(change.version || 1));
    }
    return conflicts;
  }

  async pull() {
    const token = await this.auth.getAccessToken();
    const rows = await this.client.select('family_records', {
      select: 'entity_type,record_id,payload,version,updated_at,deleted_at,device_id',
      order: 'updated_at.asc'
    }, token);
    let applied = 0;
    for (const row of rows || []) {
      const entityType = ENTITY_ALIASES[row.entity_type];
      const repository = this.repositoryByEntity[entityType];
      if (!repository || !row.payload) continue;
      const record = {
        ...row.payload, id: row.record_id, version: Number(row.version || 1),
        updatedAt: row.updated_at, deletedAt: row.deleted_at ?? row.payload.deletedAt ?? null,
        deviceId: row.device_id || row.payload.deviceId, syncStatus: 'synced'
      };
      const result = await repository.applyRemote(record);
      if (result.applied) applied += 1;
    }
    if (applied) await this.onDataChange({ applied });
    return applied;
  }

  async #run(reason) {
    this.#setState({ status: 'syncing', error: null, reason });
    const conflicts = await this.push();
    const pulled = await this.pull();
    const pending = (await this.repositories.outbox.getPendingChanges()).length;
    const next = { status: conflicts ? 'conflict' : 'synced', lastSyncAt: new Date().toISOString(), pending, conflicts, error: null, reason: null };
    this.#setState(next);
    await this.cloudRepository.set('sync-state', next);
    return { ok: true, conflicts, pulled, pending };
  }

  async #updatePending() {
    const pending = (await this.repositories.outbox.getPendingChanges()).length;
    this.#setState({ pending });
  }

  #setState(changes) {
    this.state = { ...this.state, ...changes };
    this.onStateChange(this.state);
  }
}

export { ENTITY_ALIASES, newestByRecord };
