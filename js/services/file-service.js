import { STORES } from '../config.js';
import { withTransaction } from '../database/indexed-db.js';
import { uuid } from '../utils/uuid.js';

const PRIVATE_BUCKET = 'samen-thuis-private';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set(['application/pdf', 'text/plain']);
const MAX_IMAGE_INPUT = 12 * 1024 * 1024;
const MAX_DOCUMENT = 5 * 1024 * 1024;
const MAX_IMAGE_OUTPUT = 1024 * 1024;

function extensionFor(type) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'text/plain': 'txt' })[type] || 'bin';
}

export function validateFamilyFile(file, kind = 'file') {
  if (!file?.size) throw new Error('Kies een bestand.');
  const allowed = kind === 'image' ? IMAGE_TYPES : new Set([...IMAGE_TYPES, ...DOCUMENT_TYPES]);
  if (!allowed.has(file.type)) throw new Error(kind === 'image' ? 'Gebruik een JPG-, PNG- of WebP-afbeelding.' : 'Gebruik een afbeelding, PDF of tekstbestand.');
  const maximum = kind === 'image' ? MAX_IMAGE_INPUT : MAX_DOCUMENT;
  if (file.size > maximum) throw new Error(`Het bestand is groter dan ${Math.round(maximum / 1024 / 1024)} MB.`);
  return true;
}

async function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('De afbeelding kon niet worden gecomprimeerd.')), type, quality));
}

export async function compressFamilyImage(file) {
  validateFamilyFile(file, 'image');
  if (!globalThis.document || !globalThis.createImageBitmap) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let quality = 0.84;
  let blob = await canvasBlob(canvas, 'image/webp', quality);
  while (blob.size > MAX_IMAGE_OUTPUT && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasBlob(canvas, 'image/webp', quality);
  }
  if (blob.size > MAX_IMAGE_OUTPUT) throw new Error('De afbeelding blijft na compressie groter dan 1 MB. Kies een kleinere afbeelding.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'afbeelding'}.webp`, { type: 'image/webp', lastModified: Date.now() });
}

async function putBlob(id, blob) {
  await withTransaction([STORES.fileBlobs], 'readwrite', (tx) => tx.objectStore(STORES.fileBlobs).put({ id, blob, updatedAt: new Date().toISOString() }));
}

async function getBlob(id) {
  const record = await withTransaction([STORES.fileBlobs], 'readonly', (tx, toPromise) => toPromise(tx.objectStore(STORES.fileBlobs).get(id)));
  return record?.blob || null;
}

async function deleteBlob(id) {
  await withTransaction([STORES.fileBlobs], 'readwrite', (tx) => tx.objectStore(STORES.fileBlobs).delete(id));
}

export class FileService {
  constructor({ repository, client, auth, family }) {
    this.repository = repository;
    this.client = client;
    this.auth = auth;
    this.family = family;
    this.objectUrls = new Map();
  }

  async save({ file, kind = 'file', entityType, recordId, label = '' }) {
    validateFamilyFile(file, kind);
    const prepared = kind === 'image' ? await compressFamilyImage(file) : file;
    const id = uuid();
    await putBlob(id, prepared);
    const metadata = await this.repository.create({
      id, entityType, recordId, label: label || file.name, fileName: prepared.name || file.name,
      mimeType: prepared.type, size: prepared.size, width: null, height: null,
      storagePath: null, uploadStatus: this.family.context ? 'pending' : 'local', lastUploadError: null
    });
    if (this.family.context && navigator.onLine) await this.upload(metadata).catch(() => null);
    return id;
  }

  async upload(record) {
    if (!this.family.context) return record;
    const blob = await getBlob(record.id);
    if (!blob) throw new Error('De lokale bestandsinhoud ontbreekt.');
    const familyId = this.family.context.family_id;
    const path = `${familyId}/${record.entityType}/${record.recordId}/${record.id}.${extensionFor(record.mimeType)}`;
    try {
      const token = await this.auth.getAccessToken();
      await this.client.uploadStorage(PRIVATE_BUCKET, path, blob, token);
      return this.repository.update(record.id, { storagePath: path, uploadStatus: 'uploaded', lastUploadError: null });
    } catch (error) {
      await this.repository.update(record.id, { uploadStatus: 'pending', lastUploadError: error.message });
      throw error;
    }
  }

  async retryPending() {
    if (!this.family.context || !navigator.onLine) return 0;
    const all = await this.repository.getAll({ includeDeleted: true });
    const pendingDeletes = all.filter((item) => item.deletedAt && item.uploadStatus === 'delete_pending');
    for (const item of pendingDeletes) {
      if (item.storagePath) {
        const token = await this.auth.getAccessToken();
        await this.client.deleteStorage(PRIVATE_BUCKET, [item.storagePath], token).catch(() => null);
      }
      await this.repository.purge(item.id).catch(() => null);
    }
    const pending = all.filter((item) => !item.deletedAt && item.uploadStatus === 'pending');
    let uploaded = 0;
    for (const item of pending) if (await this.upload(item).then(() => true).catch(() => false)) uploaded += 1;
    return uploaded;
  }

  async remove(fileId) {
    if (!fileId) return false;
    const record = await this.repository.getById(fileId, { includeDeleted: true });
    if (!record) { await deleteBlob(fileId); return false; }
    this.objectUrls.has(fileId) && URL.revokeObjectURL(this.objectUrls.get(fileId));
    this.objectUrls.delete(fileId);
    await deleteBlob(fileId);
    if (!record.deletedAt) await this.repository.softDelete(fileId);
    if (record.storagePath && this.family.context && navigator.onLine) {
      const token = await this.auth.getAccessToken();
      await this.client.deleteStorage(PRIVATE_BUCKET, [record.storagePath], token);
      await this.repository.purge(fileId);
    } else if (!record.storagePath) await this.repository.purge(fileId);
    else await this.repository.update(fileId, { uploadStatus: 'delete_pending' });
    return true;
  }

  async blob(fileId) {
    let blob = await getBlob(fileId);
    if (blob) return blob;
    const record = await this.repository.getById(fileId);
    if (!record?.storagePath || !this.family.context || !navigator.onLine) return null;
    const token = await this.auth.getAccessToken();
    blob = await this.client.downloadStorage(PRIVATE_BUCKET, record.storagePath, token);
    await putBlob(fileId, blob);
    return blob;
  }

  async objectUrl(fileId) {
    if (!fileId) return null;
    if (this.objectUrls.has(fileId)) return this.objectUrls.get(fileId);
    const blob = await this.blob(fileId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(fileId, url);
    return url;
  }
}

export { PRIVATE_BUCKET, MAX_IMAGE_OUTPUT, MAX_DOCUMENT };
