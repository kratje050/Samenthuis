import { APP_NAME, APP_VERSION, DATABASE_VERSION, SETTINGS_ID, STORES } from '../config.js';
import { getDeviceId } from '../utils/device.js';
import { getStoreRecords } from '../database/indexed-db.js';

const mapping = {
  afspraken: STORES.appointments, boodschappen: STORES.shopping, taken: STORES.tasks,
  maaltijden: STORES.meals, voorraad: STORES.inventory, uitgaven: STORES.expenses,
  huisdieren: STORES.pets, uitjes: STORES.outings, activiteiten: STORES.activity,
  sjablonen: STORES.templates, assistent: STORES.assistant, geschiedenis: STORES.history,
  bestanden: STORES.files, outbox: STORES.outbox
};
const LAST_BACKUP_KEY = 'samen-thuis-last-backup';

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function getBackupStatus(now = new Date()) {
  const stored = localStorage.getItem(LAST_BACKUP_KEY);
  if (!stored) return { date: null, daysAgo: null, stale: true };
  const date = new Date(stored);
  if (Number.isNaN(date.getTime())) return { date: null, daysAgo: null, stale: true };
  const daysAgo = Math.max(0, Math.floor((now - date) / 86400000));
  return { date, daysAgo, stale: daysAgo >= 14 };
}

export async function createBackupObject() {
  const settings = (await getStoreRecords(STORES.settings)).find((item) => item.id === SETTINGS_ID) || {};
  const backup = {
    appName: APP_NAME, appVersion: APP_VERSION, databaseVersion: DATABASE_VERSION,
    exportedAt: new Date().toISOString(), deviceId: getDeviceId(),
    instellingen: settings, gezinsleden: settings.members || []
  };
  for (const [key, store] of Object.entries(mapping)) backup[key] = await getStoreRecords(store);
  const blobs = await getStoreRecords(STORES.fileBlobs);
  backup.bestandInhoud = await Promise.all(blobs.map(async ({ id, blob }) => ({
    id, type: blob.type || 'application/octet-stream', data: await blobToBase64(blob)
  })));
  return backup;
}

export async function downloadBackup() {
  const backup = await createBackupObject();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `samen-thuis-backup-${backup.exportedAt.slice(0, 10)}.json`;
  anchor.hidden = true;
  document.body.append(anchor);
  localStorage.setItem(LAST_BACKUP_KEY, backup.exportedAt);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup;
}

export { mapping as BACKUP_STORE_MAPPING };
