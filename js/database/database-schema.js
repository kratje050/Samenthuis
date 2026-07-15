import { STORES } from '../config.js';

const indexes = {
  appointments: [['date', 'date'], ['updatedAt', 'updatedAt'], ['syncStatus', 'syncStatus'], ['deletedAt', 'deletedAt']],
  shopping: [['checked', 'checked'], ['category', 'category'], ['updatedAt', 'updatedAt'], ['deletedAt', 'deletedAt']],
  tasks: [['status', 'status'], ['date', 'date'], ['assignedTo', 'assignedTo'], ['deletedAt', 'deletedAt']],
  meals: [['date', 'date'], ['kind', 'kind'], ['favorite', 'favorite'], ['deletedAt', 'deletedAt']],
  inventory: [['category', 'category'], ['expiryDate', 'expiryDate'], ['deletedAt', 'deletedAt']],
  expenses: [['date', 'date'], ['category', 'category'], ['paidBy', 'paidBy'], ['deletedAt', 'deletedAt']],
  pets: [['name', 'name'], ['deletedAt', 'deletedAt']],
  outings: [['date', 'date'], ['category', 'category'], ['favorite', 'favorite'], ['deletedAt', 'deletedAt']],
  settings: [['updatedAt', 'updatedAt']],
  outbox: [['processed', 'processed'], ['changedAt', 'changedAt'], ['entityType', 'entityType'], ['recordId', 'recordId']],
  backups: [['createdAt', 'createdAt']]
};

export function createSchema(database, transaction) {
  Object.values(STORES).forEach((storeName) => {
    let store;
    if (!database.objectStoreNames.contains(storeName)) {
      const keyPath = storeName === STORES.outbox ? 'changeId' : storeName === STORES.backups ? 'backupId' : 'id';
      store = database.createObjectStore(storeName, { keyPath });
    } else {
      store = transaction.objectStore(storeName);
    }
    (indexes[storeName] || []).forEach(([name, keyPath]) => {
      if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false });
    });
  });
}
