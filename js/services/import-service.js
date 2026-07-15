import { APP_NAME, DATABASE_VERSION, SETTINGS_ID, STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';
import { uuid } from '../utils/uuid.js';
import { getDeviceId } from '../utils/device.js';
import { validateBackup } from './validation-service.js';
import { createBackupObject, BACKUP_STORE_MAPPING } from './backup-service.js';

function newer(incoming, existing) {
  if (!existing) return true;
  if (Number(incoming.version || 0) !== Number(existing.version || 0)) return Number(incoming.version || 0) > Number(existing.version || 0);
  return String(incoming.updatedAt || '') > String(existing.updatedAt || '');
}

export async function parseBackupFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Het gekozen bestand bevat geen geldige JSON.'); }
  validateBackup(data, { appName: APP_NAME, databaseVersion: DATABASE_VERSION });
  return data;
}

export async function importBackup(backup, mode = 'merge') {
  validateBackup(backup, { appName: APP_NAME, databaseVersion: DATABASE_VERSION });
  if (!['merge', 'replace'].includes(mode)) throw new Error('Kies samenvoegen of vervangen.');
  const safety = await createBackupObject();
  await withTransaction([STORES.backups], 'readwrite', (tx) => tx.objectStore(STORES.backups).put({ backupId: uuid(), createdAt: new Date().toISOString(), reason: 'voor-import', data: safety }));

  const domainStores = Object.values(BACKUP_STORE_MAPPING).filter((name) => name !== STORES.outbox);
  const transactionStores = [...domainStores, STORES.settings, STORES.outbox];
  await withTransaction(transactionStores, 'readwrite', async (tx, toPromise) => {
    if (mode === 'replace') transactionStores.forEach((name) => tx.objectStore(name).clear());
    const now = new Date().toISOString();
    for (const [section, storeName] of Object.entries(BACKUP_STORE_MAPPING)) {
      if (storeName === STORES.outbox) continue;
      const store = tx.objectStore(storeName);
      for (const source of backup[section] || []) {
        const existing = mode === 'merge' ? await toPromise(store.get(source.id)) : null;
        if (mode === 'replace' || newer(source, existing)) {
          const record = { ...source, syncStatus: 'pending', updatedAt: source.updatedAt || now };
          store.put(record);
          const entityType = storeName === STORES.assistant ? record.module : storeName === STORES.history ? 'history' : storeName === STORES.files ? 'file' : storeName;
          tx.objectStore(STORES.outbox).put({ changeId: uuid(), entityType, recordId: record.id, operation: record.deletedAt ? 'delete' : existing ? 'update' : 'create', payload: record, version: record.version || 1, changedAt: now, deviceId: getDeviceId(), processed: false });
        }
      }
    }
    const settingsStore = tx.objectStore(STORES.settings);
    const currentSettings = mode === 'merge' ? await toPromise(settingsStore.get(SETTINGS_ID)) : null;
    const importedSettings = { ...backup.instellingen, id: SETTINGS_ID, members: backup.gezinsleden, syncStatus: 'pending', updatedAt: now, deviceId: getDeviceId() };
    const settingsRecord = mode === 'merge' && currentSettings ? { ...currentSettings, ...importedSettings, version: Math.max(currentSettings.version || 1, importedSettings.version || 1) + 1 } : importedSettings;
    settingsStore.put(settingsRecord);
    tx.objectStore(STORES.outbox).put({ changeId: uuid(), entityType: 'settings', recordId: SETTINGS_ID, operation: currentSettings ? 'update' : 'create', payload: settingsRecord, version: settingsRecord.version || 1, changedAt: now, deviceId: getDeviceId(), processed: false });
  });
  if (mode === 'replace' || (backup.bestandInhoud || []).length) {
    await withTransaction([STORES.fileBlobs], 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.fileBlobs);
      if (mode === 'replace') store.clear();
      (backup.bestandInhoud || []).forEach((item) => {
        const bytes = Uint8Array.from(atob(item.data), (character) => character.charCodeAt(0));
        store.put({ id: item.id, blob: new Blob([bytes], { type: item.type }), updatedAt: new Date().toISOString() });
      });
    });
  }
  return { mode, safetyCreated: true };
}
