import { withTransaction } from '../database/indexed-db.js';

export class OutboxRepository {
  async getAll() {
    return withTransaction(['outbox'], 'readonly', (tx, toPromise) => toPromise(tx.objectStore('outbox').getAll()));
  }
  async getPendingChanges() { return (await this.getAll()).filter((item) => !item.processed); }
  async markProcessed(changeId) {
    return withTransaction(['outbox'], 'readwrite', async (tx, toPromise) => {
      const store = tx.objectStore('outbox');
      const item = await toPromise(store.get(changeId));
      if (item) store.put({ ...item, processed: true, processedAt: new Date().toISOString() });
    });
  }
}
