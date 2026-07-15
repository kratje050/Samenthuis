import { withTransaction } from '../database/indexed-db.js';
import { uuid } from '../utils/uuid.js';
import { getDeviceId } from '../utils/device.js';

export class OutboxRepository {
  async getAll() {
    return withTransaction(['outbox'], 'readonly', (tx, toPromise) => toPromise(tx.objectStore('outbox').getAll()));
  }
  async getPendingChanges() { return (await this.getAll()).filter((item) => !item.processed).sort((a, b) => String(a.changedAt).localeCompare(String(b.changedAt))); }
  async markProcessed(changeId) {
    return withTransaction(['outbox'], 'readwrite', async (tx, toPromise) => {
      const store = tx.objectStore('outbox');
      const item = await toPromise(store.get(changeId));
      if (item) store.put({ ...item, processed: true, processedAt: new Date().toISOString() });
    });
  }

  async queue(entityType, record, operation = null) {
    const changedAt = record.updatedAt || new Date().toISOString();
    const item = {
      changeId: uuid(), entityType, recordId: record.id,
      operation: operation || (record.deletedAt ? 'delete' : 'update'),
      payload: structuredClone(record), version: Number(record.version || 1),
      changedAt, deviceId: record.deviceId || getDeviceId(), processed: false
    };
    await withTransaction(['outbox'], 'readwrite', (tx) => tx.objectStore('outbox').put(item));
    return item;
  }

  async markRecordProcessed(entityType, recordId, throughVersion = Number.MAX_SAFE_INTEGER) {
    return withTransaction(['outbox'], 'readwrite', async (tx, toPromise) => {
      const store = tx.objectStore('outbox');
      const items = await toPromise(store.getAll());
      const processedAt = new Date().toISOString();
      items.filter((item) => !item.processed && item.entityType === entityType && item.recordId === recordId && Number(item.version || 0) <= throughVersion)
        .forEach((item) => store.put({ ...item, processed: true, processedAt }));
    });
  }
}
