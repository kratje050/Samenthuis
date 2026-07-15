import { addDays, addMonths, fromDateKey, toDateKey } from '../utils/dates.js';

function nextOccurrence(date, type, interval = 1, unit = 'days') {
  if (type === 'weekdays') {
    let next = addDays(date, 1);
    while ([0, 6].includes(next.getDay())) next = addDays(next, 1);
    return next;
  }
  if (type === 'weekly') return addDays(date, 7);
  if (type === 'biweekly') return addDays(date, 14);
  if (type === 'monthly') return addMonths(date, 1);
  if (type === 'yearly') return addMonths(date, 12);
  if (type === 'custom') {
    if (unit === 'weeks') return addDays(date, 7 * Math.max(1, interval));
    if (unit === 'months') return addMonths(date, Math.max(1, interval));
    return addDays(date, Math.max(1, interval));
  }
  return addDays(date, 1);
}

export function expandAppointment(record, rangeStart, rangeEnd, max = 1000) {
  if (!record || record.deletedAt) return [];
  const first = fromDateKey(record.date);
  const start = new Date(rangeStart); start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd); end.setHours(23, 59, 59, 999);
  const until = record.recurrenceUntil ? fromDateKey(record.recurrenceUntil) : end;
  const stop = until < end ? until : end;
  const type = record.recurrence || 'none';
  const occurrences = [];
  let cursor = first;
  let safety = 0;
  while (cursor <= stop && safety < max) {
    if (cursor >= start) occurrences.push({ ...record, occurrenceDate: toDateKey(cursor), occurrenceId: `${record.id}:${toDateKey(cursor)}` });
    if (type === 'none') break;
    cursor = nextOccurrence(cursor, type, Number(record.recurrenceInterval || 1), record.recurrenceUnit || 'days');
    safety += 1;
  }
  return occurrences;
}

export function nextTaskDate(task, completedAt = new Date()) {
  const type = task.recurrence || 'none';
  if (type === 'none') return null;
  const base = task.date ? fromDateKey(task.date) : new Date(completedAt);
  let next = base;
  const today = new Date(completedAt); today.setHours(0, 0, 0, 0);
  do {
    if (type === 'weekly') next = addDays(next, 7);
    else if (type === 'monthly') next = addMonths(next, 1);
    else if (type === 'custom') next = nextOccurrence(next, 'custom', Number(task.recurrenceInterval || 1), task.recurrenceUnit || 'days');
    else next = addDays(next, 1);
  } while (next <= today);
  return toDateKey(next);
}
