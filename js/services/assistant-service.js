import { uuid } from '../utils/uuid.js';
import { toDateKey } from '../utils/dates.js';
import { calculateRoutinePoints } from './points-service.js';

function text(formData, name) { return String(formData.get(name) ?? '').trim(); }
function number(formData, name, fallback = 0) { const parsed = Number(formData.get(name)); return Number.isFinite(parsed) ? parsed : fallback; }
function lines(value) { return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }

function complexRows(form, fieldName, keys) {
  return [...form.querySelectorAll(`[data-complex-field="${fieldName}"] [data-complex-row]`)].map((row) => {
    const item = { id: row.dataset.rowId || uuid() };
    keys.forEach((key) => {
      const input = row.querySelector(`[data-key="${key}"]`);
      if (!input) return;
      item[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value || 0) : input.value.trim();
    });
    return item;
  }).filter((item) => item.text || item.name || item.date || item.amount);
}

async function sha256(value) {
  if (!value) return '';
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function serializeAssistantForm({ definition, module, formData, form, existing = {}, fileService, recordId }) {
  const result = {};
  for (const descriptor of definition.fields) {
    const { name, type } = descriptor;
    if (['image', 'file'].includes(type)) {
      const selected = form.querySelector(`[name="${name}"]`)?.files?.[0];
      if (selected) result[name] = await fileService.save({ file: selected, kind: type, entityType: module, recordId, label: descriptor.label });
      else result[name] = existing[name] || null;
    } else if (type === 'checkbox') result[name] = formData.has(name);
    else if (['members', 'cloudMembers', 'weekdays'].includes(type)) result[name] = formData.getAll(name).map(String);
    else if (type === 'number') result[name] = number(formData, name, Number(descriptor.default || 0));
    else if (type === 'lines') result[name] = lines(text(formData, name));
    else if (type === 'checklist') result[name] = complexRows(form, name, ['text', 'quantity', 'category', 'memberId', 'essential', 'done', 'note']);
    else if (type === 'transactions') result[name] = complexRows(form, name, ['date', 'amount', 'note']);
    else if (type === 'guestList') result[name] = complexRows(form, name, ['name', 'guestType', 'attendance']);
    else if (type === 'choices') result[name] = complexRows(form, name, ['text', 'excluded']);
    else if (type === 'pin') {
      const pin = text(formData, name);
      result[name] = pin ? await sha256(pin) : existing[name] || '';
    } else result[name] = text(formData, name) || descriptor.default || '';
  }

  if (module === 'price_history') {
    result.unitPrice = result.quantity > 0 ? Math.round((result.price / result.quantity) * 1000) / 1000 : 0;
  }
  if (module === 'routine') {
    const calculation = calculateRoutinePoints(result);
    result.pointValue = calculation.points;
    result.pointsAutomatic = true;
    result.pointsReason = calculation.reasons.join(' · ');
    result.dailyProgress = existing.dailyProgress || {};
    result.completionHistory = existing.completionHistory || [];
  }
  if (module === 'savings_goal' && !Array.isArray(result.transactions)) result.transactions = existing.transactions || [];
  if (module === 'inbox') {
    result.convertedRecords = existing.convertedRecords || {};
    result.processed = Boolean(result.processed);
  }
  if (module === 'notice') result.readBy = result.readBy || [];
  return result;
}

export function validateAssistantRecord(definition, record) {
  for (const field of definition.fields.filter((item) => item.required)) {
    const value = record[field.name];
    if (value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length)) throw new Error(`Vul “${field.label}” in.`);
  }
  const start = record.startAt || record.startDate;
  const end = record.endAt || record.endDate;
  if (start && end && String(end) < String(start)) throw new Error('De einddatum of eindtijd mag niet vóór de start liggen.');
  if (record.link && !/^https?:\/\//i.test(record.link)) throw new Error('De link moet beginnen met http:// of https://.');
  return true;
}

export function assistantSearchText(record) {
  return Object.entries(record).filter(([key]) => !['snapshot', 'conflictData'].includes(key)).map(([, value]) => {
    if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? Object.values(item).join(' ') : item).join(' ');
    return typeof value === 'object' ? '' : value;
  }).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL');
}

export function filterAssistantRecords(records, {
  query = '', status = 'all', typeField = '', type = 'all', memberField = '', memberId = 'all',
  module = '', includeExpired = false, today = toDateKey()
} = {}) {
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL').trim();
  return records.filter((record) => {
    const effectiveStatus = module === 'routine' && record.reminderDisabled && record.starterKind === 'family-routine' && record.status === 'archived'
      ? 'active'
      : String(record.status || 'active');
    if (status !== 'all' && effectiveStatus !== status) return false;
    if (typeField && type !== 'all' && String(record[typeField] || '') !== type) return false;
    if (memberField && memberId !== 'all') {
      const assigned = Array.isArray(record[memberField]) ? record[memberField] : [record[memberField]];
      if (!assigned.includes(memberId)) return false;
    }
    if (module === 'notice' && !includeExpired && record.expiryDate && record.expiryDate < today) return false;
    return !normalized || assistantSearchText(record).includes(normalized);
  });
}

export function recordTitle(definition, record) {
  return record[definition.titleField] || record.title || record.name || record.item || record.activity || definition.singular;
}

export function isOverdue(record) {
  const date = record.expectedReturnDate || record.nextDate || record.contractEndDate || record.trialEndDate || record.date;
  return Boolean(date && String(date).slice(0, 10) < toDateKey() && !['done', 'returned', 'ended', 'archived'].includes(record.status));
}

export async function addSavingsTransaction(repository, record, amount, note = '') {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Vul een bedrag groter of kleiner dan nul in.');
  const transactions = [...(record.transactions || []), { id: uuid(), date: toDateKey(), amount, note }];
  const currentAmount = Math.max(0, Number(record.currentAmount || 0) + amount);
  return repository.update(record.id, { transactions, currentAmount, status: currentAmount >= Number(record.targetAmount || Infinity) ? 'achieved' : record.status });
}

export async function toggleComplexItem(repository, record, fieldName, itemId) {
  const items = (record[fieldName] || []).map((item) => item.id === itemId ? { ...item, done: !item.done } : item);
  return repository.update(record.id, { [fieldName]: items });
}

export { lines, sha256 };
