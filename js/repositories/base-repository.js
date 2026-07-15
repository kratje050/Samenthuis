import { STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';
import { uuid } from '../utils/uuid.js';
import { getDeviceId } from '../utils/device.js';

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

  async #mutate(record, operation) {
    await withTransaction([this.storeName, STORES.outbox], 'readwrite', (tx) => {
      tx.objectStore(this.storeName).put(record);
      tx.objectStore(STORES.outbox).put({
        changeId: uuid(), entityType: this.entityType, recordId: record.id, operation,
        payload: structuredClone(record), version: record.version, changedAt: record.updatedAt,
        deviceId: record.deviceId, processed: false
      });
    });
  }
}
