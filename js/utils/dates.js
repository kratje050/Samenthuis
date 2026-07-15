const pad = (value) => String(value).padStart(2, '0');

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(value, time = '00:00') {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const [hours, minutes] = (time || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
}

export function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function addMonths(date, amount) {
  const copy = new Date(date);
  const targetDay = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + amount);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(targetDay, lastDay));
  return copy;
}

export function startOfWeek(date, weekStartsOn = 1) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const difference = (result.getDay() - weekStartsOn + 7) % 7;
  result.setDate(result.getDate() - difference);
  return result;
}

export function endOfWeek(date, weekStartsOn = 1) {
  const result = addDays(startOfWeek(date, weekStartsOn), 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
export function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999); }

export function dateRange(start, end) {
  const days = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) days.push(new Date(cursor));
  return days;
}

export function formatDate(value, options = { weekday: 'short', day: 'numeric', month: 'long' }) {
  const date = typeof value === 'string' ? fromDateKey(value) : value;
  return date ? new Intl.DateTimeFormat('nl-NL', options).format(date) : '';
}

export function formatShortDate(value) {
  return formatDate(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(value) { return value ? value.slice(0, 5) : '' }

export function dateTimeForRecord(record, occurrenceDate = record.date) {
  return fromDateKey(occurrenceDate, record.allDay ? '09:00' : record.startTime || record.time || '09:00');
}

export function isSameDay(a, b) { return toDateKey(a) === toDateKey(b); }
export function daysBetween(a, b) {
  const start = fromDateKey(toDateKey(a));
  const end = fromDateKey(toDateKey(b));
  return Math.round((end - start) / 86400000);
}

export function monthKey(value = new Date()) { return toDateKey(value).slice(0, 7); }
