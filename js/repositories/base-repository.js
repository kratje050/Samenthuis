import { STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';
import { uuid } from '../utils/uuid.js';
import { getDeviceId } from '../utils/device.js';
import { getActiveActor } from '../utils/actor.js';

function activityTitle(record, entityType) {
  return record.title || record.productName || record.name || record.description || record.category || entityType;
}

export class BaseRepository {
  constructor(storeName, entityType = storeName, { history = true, activity = true } = {}) {
    this.storeName = storeName;
    this.entityType = entityType;
    this.historyEnabled = history;
    this.activityEnabled = activity;
  }

  async getAll({ includeDeleted = false } = {}) {
    const records = await withTransaction([this.storeName], 'readonly', (tx, toPromise) => toPromise(tx.objectStore(this.storeName).getAll()));
    return includeDeleted ? records : records.filter((record) => !record.deletedAt);
  }

  async getById(id, { includeDeleted = false } = {}) {
    const record = await withTransaction([this.storeName], 'readonly', (tx, toPromise) => toPromise(tx.objectStore(this.storeName).get(id)));
    return record && (includeDeleted || !record.deletedAt) ? record : null;
  }

  async create(data, updatedBy = 'device') {
    const now = new Date().toISOString();
    const record = {
      ...data, id: data.id || uuid(), createdAt: data.createdAt || now, updatedAt: now,
      deletedAt: null, version: Number(data.version || 0) + 1, deviceId: getDeviceId(),
      syncStatus: 'pending', createdBy: data.createdBy || updatedBy, updatedBy
    };
    await this.#mutate(record, 'create');
    return record;
  }

  async update(id, changes, updatedBy = 'device') {
    const current = await this.getById(id, { includeDeleted: true });
    if (!current) throw new Error('Het item bestaat niet meer. Vernieuw de pagina en probeer opnieuw.');
    const record = {
      ...current, ...changes, id: current.id, createdAt: current.createdAt,
      updatedAt: new Date().toISOString(), version: Number(current.version || 0) + 1,
      deviceId: getDeviceId(), syncStatus: 'pending', updatedBy
    };
    await this.#mutate(record, record.deletedAt ? 'delete' : 'update', current);
    return record;
  }

  async softDelete(id, updatedBy = 'device') {
    const current = await this.getById(id, { includeDeleted: true });
    if (!current) throw new Error('Het item bestaat niet meer.');
    if (current.deletedAt) return current;
    const now = new Date().toISOString();
    const record = { ...current, deletedAt: now, updatedAt: now, version: Number(current.version || 0) + 1, deviceId: getDeviceId(), syncStatus: 'pending', updatedBy };
    await this.#mutate(record, 'delete', current);
    return record;
  }

  async restore(id, updatedBy = 'device') {
    const current = await this.getById(id, { includeDeleted: true });
    if (!current) throw new Error('Het item bestaat niet meer.');
    const now = new Date().toISOString();
    const record = { ...current, deletedAt: null, updatedAt: now, version: Number(current.version || 0) + 1, deviceId: getDeviceId(), syncStatus: 'pending', updatedBy };
    await this.#mutate(record, 'update', current);
    return record;
  }

  async purge(id, updatedBy = 'device') {
    const current = await this.getById(id, { includeDeleted: true });
    if (!current?.deletedAt) throw new Error('Alleen een verwijderd item kan definitief worden verwijderd.');
    const now = new Date().toISOString();
    const tombstone = {
      id: current.id, ...(current.module ? { module: current.module } : {}),
      createdAt: current.createdAt, createdBy: current.createdBy || current.updatedBy,
      updatedAt: now, deletedAt: current.deletedAt, purgedAt: now,
      version: Number(current.version || 0) + 1, deviceId: getDeviceId(), syncStatus: 'pending', updatedBy
    };
    await withTransaction([this.storeName, STORES.outbox, STORES.history], 'readwrite', async (tx, toPromise) => {
      tx.objectStore(this.storeName).put(tombstone);
      tx.objectStore(STORES.outbox).put({ changeId: uuid(), entityType: this.entityType, recordId: tombstone.id, operation: 'delete', payload: structuredClone(tombstone), version: tombstone.version, changedAt: now, deviceId: tombstone.deviceId, processed: false });
      const historyStore = tx.objectStore(STORES.history);
      const histories = await toPromise(historyStore.getAll());
      histories.filter((item) => item.sourceEntity === this.entityType && item.recordId === id).forEach((item) => historyStore.delete(item.id));
    });
    globalThis.dispatchEvent?.(new CustomEvent('samen-thuis-local-change', { detail: { entityType: this.entityType, recordId: tombstone.id } }));
    return tombstone;
  }

  async getChangesSince(updatedAt, { includeDeleted = true } = {}) {
    const records = await this.getAll({ includeDeleted });
    return records.filter((record) => String(record.updatedAt || '') > String(updatedAt || '')).sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
  }

  async count() {
    const records = await this.getAll();
    return records.length;
  }

  async applyRemote(remoteRecord, { conflict = false } = {}) {
    if (!remoteRecord?.id) throw new Error('Het centrale record mist een ID.');
    return withTransaction([this.storeName], 'readwrite', async (tx, toPromise) => {
      const store = tx.objectStore(this.storeName);
      const current = await toPromise(store.get(remoteRecord.id));
      const remoteVersion = Number(remoteRecord.version || 0);
      const currentVersion = Number(current?.version || 0);
      const remoteIsNewer = !current || remoteVersion > currentVersion || (remoteVersion === currentVersion && String(remoteRecord.updatedAt || '') >= String(current.updatedAt || ''));
      if (!remoteIsNewer) return { applied: false, record: current };
      const record = { ...remoteRecord, syncStatus: conflict ? 'conflict' : 'synced' };
      store.put(record);
      return { applied: true, record };
    });
  }

  async markSynced(id, serverRecord = null, { conflict = false, localRecord = null } = {}) {
    const stores = conflict ? [this.storeName, STORES.history] : [this.storeName];
    return withTransaction(stores, 'readwrite', async (tx, toPromise) => {
      const store = tx.objectStore(this.storeName);
      const current = await toPromise(store.get(id));
      if (!current && !serverRecord) return null;
      const local = structuredClone(localRecord || current || {});
      const remote = structuredClone(serverRecord || current || {});
      const record = {
        ...(current || {}), ...(serverRecord || {}), id,
        syncStatus: conflict ? 'conflict' : 'synced',
        ...(conflict ? { conflictData: { local, remote, detectedAt: new Date().toISOString() } } : { conflictData: null })
      };
      store.put(record);
      if (conflict) {
        const historyStore = tx.objectStore(STORES.history);
        const now = new Date().toISOString();
        [
          { variant: 'local', snapshot: local },
          { variant: 'remote', snapshot: remote }
        ].forEach(({ variant, snapshot }) => historyStore.put({
          id: uuid(), sourceEntity: this.entityType, recordId: id,
          sourceVersion: Number(snapshot.version || 0), snapshot, variant,
          changedAt: now, changedBy: snapshot.updatedBy || 'sync', changedByName: 'Synchronisatie',
          createdAt: now, updatedAt: now, deletedAt: null, version: 1,
          deviceId: getDeviceId(), syncStatus: 'local', createdBy: 'sync', updatedBy: 'sync'
        }));
      }
      return record;
    });
  }

  async #mutate(record, operation, previous = null) {
    const trackActivity = this.activityEnabled && this.storeName !== STORES.activity;
    const trackHistory = this.historyEnabled && previous && this.storeName !== STORES.history;
    const stores = [...new Set([this.storeName, STORES.outbox, ...(trackActivity ? [STORES.activity] : []), ...(trackHistory ? [STORES.history] : [])])];
    await withTransaction(stores, 'readwrite', async (tx, toPromise) => {
      tx.objectStore(this.storeName).put(record);
      const outbox = tx.objectStore(STORES.outbox);
      outbox.put({
        changeId: uuid(), entityType: this.entityType, recordId: record.id, operation,
        payload: structuredClone(record), version: record.version, changedAt: record.updatedAt,
        deviceId: record.deviceId, processed: false
      });
      if (trackActivity) {
        const actor = getActiveActor();
        const activityId = uuid();
        const activity = {
          id: activityId, entityType: this.entityType, recordId: record.id, action: operation,
          title: activityTitle(record, this.entityType), actorId: actor.id, actorName: actor.name,
          occurredAt: record.updatedAt, createdAt: record.updatedAt, updatedAt: record.updatedAt,
          deletedAt: null, version: 1, deviceId: record.deviceId, syncStatus: 'pending', updatedBy: actor.id
        };
        tx.objectStore(STORES.activity).put(activity);
        outbox.put({
          changeId: uuid(), entityType: 'activity', recordId: activityId, operation: 'create',
          payload: structuredClone(activity), version: 1, changedAt: activity.updatedAt,
          deviceId: activity.deviceId, processed: false
        });
      }
      if (trackHistory) {
        const historyStore = tx.objectStore(STORES.history);
        const historyId = uuid();
        const actor = getActiveActor();
        const history = {
          id: historyId, sourceEntity: this.entityType, recordId: record.id,
          sourceVersion: Number(previous.version || 0), snapshot: structuredClone(previous),
          changedAt: record.updatedAt, changedBy: actor.id, changedByName: actor.name,
          createdAt: record.updatedAt, updatedAt: record.updatedAt, deletedAt: null,
          version: 1, deviceId: record.deviceId, syncStatus: 'pending',
          createdBy: actor.id, updatedBy: actor.id
        };
        historyStore.put(history);
        outbox.put({
          changeId: uuid(), entityType: 'history', recordId: historyId, operation: 'create',
          payload: structuredClone(history), version: 1, changedAt: history.updatedAt,
          deviceId: history.deviceId, processed: false
        });
        const existing = await toPromise(historyStore.getAll());
        existing.filter((item) => item.sourceEntity === this.entityType && item.recordId === record.id)
          .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt))).slice(10)
          .forEach((item) => historyStore.delete(item.id));
      }
    });
    globalThis.dispatchEvent?.(new CustomEvent('samen-thuis-local-change', { detail: { entityType: this.entityType, recordId: record.id } }));
  }
}
