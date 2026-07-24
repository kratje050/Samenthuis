import { addDays, addMonths, fromDateKey, toDateKey } from '../utils/dates.js';

export function nextRecurringDate(dateKey, recurrence = '') {
  if (!dateKey || !recurrence || /^(none|nooit|eenmalig)$/i.test(String(recurrence).trim())) return null;
  const value = String(recurrence).trim().toLocaleLowerCase('nl-NL');
  const source = fromDateKey(dateKey);
  const interval = Math.max(1, Number(value.match(/\d+/)?.[0] || 1));
  if (/dag|daily/.test(value)) return toDateKey(addDays(source, interval));
  if (/2\s*wek|tweewek|biweekly/.test(value)) return toDateKey(addDays(source, 14));
  if (/wek|weekly/.test(value)) return toDateKey(addDays(source, 7 * interval));
  if (/maand|month/.test(value)) return toDateKey(addMonths(source, interval));
  if (/jaar|year|annual/.test(value)) return toDateKey(addMonths(source, 12 * interval));
  return null;
}

export async function completeMaintenance(repository, record, completedAt = new Date()) {
  const completedDate = toDateKey(completedAt);
  const nextDate = nextRecurringDate(record.nextDate || completedDate, record.recurrence);
  const history = [...(record.history || []), `${completedDate}: uitgevoerd`].slice(-50);
  return repository.update(record.id, {
    lastDate: completedDate,
    nextDate: nextDate || record.nextDate || '',
    history,
    status: nextDate ? 'planned' : 'done'
  });
}

export async function completeWaste(repository, record) {
  if (!record.putOutside) return repository.update(record.id, { putOutside: true });
  if (!record.broughtInside) {
    const completed = await repository.update(record.id, { broughtInside: true, status: 'done' });
    const nextDate = nextRecurringDate(record.date, record.recurrence);
    if (nextDate) {
      await repository.create({
        ...record, id: undefined, date: nextDate, putOutside: false, broughtInside: false,
        status: 'active', previousOccurrenceId: record.id
      });
    }
    return completed;
  }
  return record;
}

export async function addRewardProgress(repository, record, amount = 1, approvedBy = '') {
  if (record.approvalRequired && !approvedBy) throw new Error('Kies eerst een volwassene die deze punten goedkeurt.');
  const progress = Math.max(0, Number(record.progress || 0) + Number(amount || 0));
  const achieved = Number(record.goal || 0) > 0 && progress >= Number(record.goal);
  return repository.update(record.id, {
    progress,
    approvedBy: approvedBy || record.approvedBy || '',
    status: achieved ? 'achieved' : record.status === 'achieved' ? 'active' : record.status
  });
}
