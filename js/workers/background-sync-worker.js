(function initializeBackgroundSyncWorker(scope) {
  const DATABASE_NAME = 'samen-thuis-db';
  const SUPABASE_URL = 'https://idzfbonwkkqaqnzubmxg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_JT8fyOu93Dke7D_NlbzbCw_GsGbUPtO';
  const SESSION_KEY = 'supabase-session';
  const SYNC_STATE_KEY = 'sync-state';
  const SYNC_LOCK = 'samen-thuis-cloud-sync';
  const OUTBOX_SYNC_TAG = 'samen-thuis-outbox-sync';
  const PERIODIC_SYNC_TAG = 'samen-thuis-periodic-sync';
  const ENTITY_TO_STORE = Object.freeze({
    appointment: 'appointments', appointments: 'appointments', shopping: 'shopping',
    task: 'tasks', tasks: 'tasks', meal: 'meals', meals: 'meals', inventory: 'inventory',
    expense: 'expenses', expenses: 'expenses', pet: 'pets', pets: 'pets',
    outing: 'outings', outings: 'outings', settings: 'settings', activity: 'activity',
    activities: 'activity', template: 'templates', templates: 'templates'
  });

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('De achtergronddatabasebewerking is afgebroken.'));
    });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME);
      request.onupgradeneeded = () => {
        request.transaction.abort();
        reject(new Error('De lokale database is nog niet door de app aangemaakt.'));
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('De lokale database kon niet worden geopend.'));
    });
  }

  async function withTransaction(storeNames, mode, callback) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(storeNames, mode);
      const done = transactionDone(transaction);
      const result = await callback(transaction);
      await done;
      return result;
    } finally {
      database.close();
    }
  }

  async function getCloudValue(key) {
    const record = await withTransaction(['cloud'], 'readonly', (transaction) => requestResult(transaction.objectStore('cloud').get(key)));
    return record?.value ?? null;
  }

  function setCloudValue(key, value) {
    return withTransaction(['cloud'], 'readwrite', (transaction) => {
      transaction.objectStore('cloud').put({ key, value, updatedAt: new Date().toISOString() });
    });
  }

  async function apiRequest(path, { method = 'GET', token = null, body = null } = {}) {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token || SUPABASE_KEY}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const message = payload?.message || payload?.msg || payload?.error_description || payload?.error || `Serverfout ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function accessToken() {
    const session = await getCloudValue(SESSION_KEY);
    if (!session?.accessToken) return null;
    if (Number(session.expiresAt || 0) > Math.floor(Date.now() / 1000) + 60) return session.accessToken;
    if (!session.refreshToken) throw new Error('De cloudsessie kan niet op de achtergrond worden vernieuwd.');
    const payload = await apiRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: session.refreshToken }
    });
    if (!payload?.access_token) throw new Error('Supabase gaf geen nieuwe toegangssleutel terug.');
    const refreshed = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || session.refreshToken,
      expiresAt: Number(payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600)),
      tokenType: payload.token_type || 'bearer',
      user: payload.user || session.user || null
    };
    await setCloudValue(SESSION_KEY, refreshed);
    return refreshed.accessToken;
  }

  function newestChanges(items) {
    const newest = new Map();
    for (const item of items.filter((entry) => !entry.processed)) {
      const storeName = ENTITY_TO_STORE[item.entityType];
      if (!storeName) continue;
      const canonical = Object.entries(ENTITY_TO_STORE).find(([entity, store]) => store === storeName && !entity.endsWith('s'))?.[0] || item.entityType;
      const key = `${storeName}:${item.recordId}`;
      const current = newest.get(key);
      if (!current || Number(item.version || 0) > Number(current.version || 0) ||
        (Number(item.version || 0) === Number(current.version || 0) && String(item.changedAt || '') > String(current.changedAt || ''))) {
        newest.set(key, { ...item, canonical, storeName });
      }
    }
    return [...newest.values()];
  }

  async function pendingChanges() {
    const items = await withTransaction(['outbox'], 'readonly', (transaction) => requestResult(transaction.objectStore('outbox').getAll()));
    return newestChanges(items);
  }

  async function commitPushedChange(change, remote, conflict) {
    await withTransaction([change.storeName, 'outbox'], 'readwrite', async (transaction) => {
      const recordStore = transaction.objectStore(change.storeName);
      const current = await requestResult(recordStore.get(change.recordId));
      recordStore.put({ ...(current || {}), ...remote, id: change.recordId, syncStatus: conflict ? 'conflict' : 'synced' });
      const outbox = transaction.objectStore('outbox');
      const items = await requestResult(outbox.getAll());
      const processedAt = new Date().toISOString();
      items.filter((item) => !item.processed && item.entityType === change.entityType && item.recordId === change.recordId && Number(item.version || 0) <= Number(change.version || 1))
        .forEach((item) => outbox.put({ ...item, processed: true, processedAt }));
    });
  }

  async function pushChanges(token) {
    const changes = await pendingChanges();
    let conflicts = 0;
    for (const change of changes) {
      const payload = { ...change.payload, syncStatus: 'synced' };
      const result = await apiRequest('/rest/v1/rpc/sync_family_record', {
        method: 'POST', token,
        body: {
          p_entity_type: change.canonical,
          p_record_id: change.recordId,
          p_payload: payload,
          p_version: Number(change.version || 1),
          p_updated_at: change.changedAt,
          p_deleted_at: payload.deletedAt || null,
          p_device_id: change.deviceId || payload.deviceId || 'unknown'
        }
      });
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
      await commitPushedChange(change, remote, Boolean(response?.conflict));
    }
    return conflicts;
  }

  async function applyRemoteRow(row) {
    const storeName = ENTITY_TO_STORE[row.entity_type];
    if (!storeName || !row.payload) return false;
    return withTransaction([storeName], 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const current = await requestResult(store.get(row.record_id));
      const remote = {
        ...row.payload,
        id: row.record_id,
        version: Number(row.version || 1),
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? row.payload.deletedAt ?? null,
        deviceId: row.device_id || row.payload.deviceId,
        syncStatus: 'synced'
      };
      const remoteVersion = Number(remote.version || 0);
      const currentVersion = Number(current?.version || 0);
      const newer = !current || remoteVersion > currentVersion ||
        (remoteVersion === currentVersion && String(remote.updatedAt || '') > String(current.updatedAt || ''));
      if (newer) store.put(remote);
      return newer;
    });
  }

  async function pullChanges(token) {
    const rows = await apiRequest('/rest/v1/family_records?select=entity_type,record_id,payload,version,updated_at,deleted_at,device_id&order=updated_at.asc', { token });
    let applied = 0;
    for (const row of rows || []) if (await applyRemoteRow(row)) applied += 1;
    return applied;
  }

  async function pendingCount() {
    const items = await withTransaction(['outbox'], 'readonly', (transaction) => requestResult(transaction.objectStore('outbox').getAll()));
    return items.filter((item) => !item.processed).length;
  }

  async function notifyClients(message) {
    const clients = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'SAMEN_THUIS_BACKGROUND_SYNC', ...message }));
  }

  async function performSync(reason) {
    const token = await accessToken();
    if (!token) return { ok: true, skipped: true, reason };
    try {
      const conflicts = await pushChanges(token);
      const pulled = await pullChanges(token);
      const pending = await pendingCount();
      const state = {
        status: conflicts ? 'conflict' : 'synced', lastSyncAt: new Date().toISOString(),
        pending, conflicts, error: null, reason: null, background: true
      };
      await setCloudValue(SYNC_STATE_KEY, state);
      await notifyClients({ ok: true, pulled, ...state });
      return { ok: true, pulled, ...state };
    } catch (error) {
      const previous = await getCloudValue(SYNC_STATE_KEY).catch(() => null);
      const state = { ...(previous || {}), status: 'error', error: error.message, reason, background: true };
      await setCloudValue(SYNC_STATE_KEY, state).catch(() => {});
      await notifyClients({ ok: false, ...state }).catch(() => {});
      throw error;
    }
  }

  function runBackgroundSync(reason = 'achtergrond') {
    const run = () => performSync(reason);
    return scope.navigator?.locks?.request
      ? scope.navigator.locks.request(SYNC_LOCK, { mode: 'exclusive' }, run)
      : run();
  }

  scope.samenThuisBackgroundSync = {
    OUTBOX_SYNC_TAG,
    PERIODIC_SYNC_TAG,
    run: runBackgroundSync
  };
})(self);
