import { addDays, dateRange, endOfMonth, endOfWeek, formatDate, startOfMonth, startOfWeek, toDateKey } from '../utils/dates.js';
import { escapeHtml } from '../utils/sanitization.js';

export function monthRange(cursor) {
  return { start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) };
}

export function renderMonthCalendar(cursor, occurrences, colorForCategory) {
  const { start, end } = monthRange(cursor);
  const groups = Object.groupBy ? Object.groupBy(occurrences, (item) => item.occurrenceDate) : occurrences.reduce((map, item) => ((map[item.occurrenceDate] ||= []).push(item), map), {});
  const weekdays = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((day) => `<div class="calendar-weekday">${day}</div>`).join('');
  const days = dateRange(start, end).map((day) => {
    const key = toDateKey(day); const events = groups[key] || [];
    const classes = ['calendar-day-cell'];
    if (day.getMonth() !== cursor.getMonth()) classes.push('outside');
    if (key === toDateKey()) classes.push('today');
    return `<div class="${classes.join(' ')}"><button class="day-number mini-action" data-open-day="${key}" aria-label="Open ${formatDate(day)}">${day.getDate()}</button>
      ${events.slice(0, 3).map((item) => `<button class="calendar-event" style="--event-color:${colorForCategory(item.category)}" data-edit-appointment="${item.id}" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</button>`).join('')}
      ${events.length > 3 ? `<button class="calendar-event" data-open-day="${key}">+${events.length - 3} meer</button>` : ''}</div>`;
  }).join('');
  return `<div class="calendar-month" aria-label="Maandkalender">${weekdays}${days}</div>`;
}
