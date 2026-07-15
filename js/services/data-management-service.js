import { STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';

export async function clearLocalData() {
  const stores = Object.values(STORES);
  await withTransaction(stores, 'readwrite', (tx) => stores.forEach((store) => tx.objectStore(store).clear()));
  localStorage.removeItem('samen-thuis-last-route');
  localStorage.removeItem('samen-thuis-theme');
}
