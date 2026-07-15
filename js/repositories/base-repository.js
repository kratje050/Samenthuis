import { STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';
import { uuid } from '../utils/uuid.js';
import { getDeviceId } from '../utils/device.js';
import { getActiveActor } from '../utils/actor.js';

function activityTitle(record, entityType) {
  return record.title || record.productName || record.name || record.description || record.category || entityType;
}

export class BaseRepository {
  constructor(storeName, entityType = storeName) {
    this.storeName = storeName;
    this.entityType = entityType;
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
      syncStatus: 'pending', updatedBy
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
    await this.#mutate(record, record.deletedAt ? 'delete' : 'update');
    return record;
  }

  async softDelete(id, updatedBy = 'device') {
    const current = await this.getById(id, { includeDeleted: true });
    if (!current) throw new Error('Het item bestaat niet meer.');
    if (current.deletedAt) return current;
    const now = new Date().toISOString();
    const record = { ...current, deletedAt: now, updatedAt: now, version: Number(current.version || 0) + 1, deviceId: getDeviceId(), syncStatus: 'pending', updatedBy };
    await this.#mutate(record, 'delete');
    return record;
  }

  async restore(id, updatedBy = 'device') {
    const current = await this.getById(id, { includeDeleted: true });
    if (!current) throw new Error('Het item bestaat niet meer.');
    const now = new Date().toISOString();
    const record = { ...current, deletedAt: null, updatedAt: now, version: Number(current.version || 0) + 1, deviceId: getDeviceId(), syncStatus: 'pending', updatedBy };
    await this.#mutate(record, 'update');
    return record;
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

  async markSynced(id, serverRecord = null, { conflict = false } = {}) {
    return withTransaction([this.storeName], 'readwrite', async (tx, toPromise) => {
      const store = tx.objectStore(this.storeName);
      const current = await toPromise(store.get(id));
      if (!current && !serverRecord) return null;
      const record = { ...(current || {}), ...(serverRecord || {}), id, syncStatus: conflict ? 'conflict' : 'synced' };
      store.put(record);
      return record;
    });
  }

  async #mutate(record, operation) {
    const trackActivity = this.storeName !== STORES.activity;
    const stores = [this.storeName, STORES.outbox, ...(trackActivity ? [STORES.activity] : [])];
    await withTransaction(stores, 'readwrite', (tx) => {
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
    });
    globalThis.dispatchEvent?.(new CustomEvent('samen-thuis-local-change', { detail: { entityType: this.entityType, recordId: record.id } }));
  }
}
