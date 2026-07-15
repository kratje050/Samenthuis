import { STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';

export class CloudStateRepository {
  async get(key) {
    const record = await withTransaction([STORES.cloud], 'readonly', (tx, toPromise) => toPromise(tx.objectStore(STORES.cloud).get(key)));
    return record?.value ?? null;
  }

  async set(key, value) {
    const record = { key, value: structuredClone(value), updatedAt: new Date().toISOString() };
    await withTransaction([STORES.cloud], 'readwrite', (tx) => tx.objectStore(STORES.cloud).put(record));
    return value;
  }

  async remove(key) {
    return withTransaction([STORES.cloud], 'readwrite', (tx) => tx.objectStore(STORES.cloud).delete(key));
  }
}
