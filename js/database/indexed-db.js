import { DATABASE_NAME, DATABASE_VERSION, STORES, DEFAULT_MEMBERS, MEMBER_IDS, SETTINGS_ID, APPOINTMENT_CATEGORIES, SHOPPING_CATEGORIES, EXPENSE_CATEGORIES, OUTING_CATEGORIES } from '../config.js';
import { runMigrations } from './migrations.js';
import { getDeviceId } from '../utils/device.js';

let connectionPromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('De databasebewerking is afgebroken.'));
  });
}

export function openDatabase() {
  if (!connectionPromise) {
    connectionPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = runMigrations;
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Sluit andere tabbladen van Samen Thuis en probeer opnieuw.'));
    });
  }
  return connectionPromise;
}

export async function withTransaction(storeNames, mode, callback) {
  const database = await openDatabase();
  const transaction = database.transaction(storeNames, mode);
  const result = await callback(transaction, requestToPromise);
  await transactionDone(transaction);
  return result;
}

export async function getStoreRecords(storeName) {
  return withTransaction([storeName], 'readonly', (tx, toPromise) => toPromise(tx.objectStore(storeName).getAll()));
}

export async function seedDatabase() {
  const now = new Date().toISOString();
  await withTransaction([STORES.settings], 'readwrite', async (tx, toPromise) => {
    const store = tx.objectStore(STORES.settings);
    const existing = await toPromise(store.get(SETTINGS_ID));
    if (existing) return;
    const legacy = await toPromise(store.get('app'));
    if (legacy) {
      store.put({ ...legacy, id: SETTINGS_ID, members: (legacy.members || DEFAULT_MEMBERS).map((member) => ({ ...member, id: MEMBER_IDS[member.id] || member.id })) });
      store.delete('app');
      return;
    }
    store.put({
      id: SETTINGS_ID,
      members: DEFAULT_MEMBERS,
      categories: {
        appointments: APPOINTMENT_CATEGORIES,
        shopping: SHOPPING_CATEGORIES,
        expenses: EXPENSE_CATEGORIES,
        outings: OUTING_CATEGORIES
      },
      theme: 'light', dateFormat: 'dd-mm-yyyy', timeFormat: '24h', currency: 'EUR',
      notifications: false, weekStartsOn: 1, greetingName: '',
      createdAt: now, updatedAt: now, deletedAt: null, version: 1,
      deviceId: getDeviceId(), syncStatus: 'local', updatedBy: 'system'
    });
  });
}

export async function initializeDatabase() {
  await openDatabase();
  await seedDatabase();
  await migrateLegacyMemberIds();
}

async function migrateLegacyMemberIds() {
  const idMap = MEMBER_IDS;
  const storeNames = [STORES.appointments, STORES.shopping, STORES.tasks, STORES.expenses, STORES.outbox];
  await withTransaction(storeNames, 'readwrite', async (tx, toPromise) => {
    const remap = (record) => {
      const next = { ...record };
      if (Array.isArray(next.members)) next.members = next.members.map((id) => idMap[id] || id);
      ['addedBy', 'checkedBy', 'assignedTo', 'paidBy', 'updatedBy'].forEach((key) => { if (idMap[next[key]]) next[key] = idMap[next[key]]; });
      if (next.payload) next.payload = remap(next.payload);
      return next;
    };
    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      const records = await toPromise(store.getAll());
      records.forEach((record) => {
        const converted = remap(record);
        if (JSON.stringify(converted) !== JSON.stringify(record)) store.put(converted);
      });
    }
  });
}

export function resetConnectionForTests() {
  connectionPromise = undefined;
}

export async function closeDatabaseForTests() {
  if (connectionPromise) {
    const database = await connectionPromise.catch(() => null);
    database?.close();
  }
  connectionPromise = undefined;
}
