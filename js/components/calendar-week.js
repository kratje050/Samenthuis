import { dateRange, endOfWeek, formatDate, startOfWeek, toDateKey } from '../utils/dates.js';
import { escapeHtml } from '../utils/sanitization.js';

export function weekRange(cursor) { return { start: startOfWeek(cursor), end: endOfWeek(cursor) }; }

export function renderWeekCalendar(cursor, occurrences, colorForCategory) {
  const { start, end } = weekRange(cursor);
  return `<div class="week-grid">${dateRange(start, end).map((day) => {
    const key = toDateKey(day); const items = occurrences.filter((item) => item.occurrenceDate === key);
    return `<section class="week-column ${key === toDateKey() ? 'today' : ''}"><h3>${formatDate(day, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>
      <div class="item-list">${items.map((item) => `<button class="calendar-event" style="--event-color:${colorForCategory(item.category)}" data-edit-appointment="${item.id}">${item.allDay ? 'Hele dag' : item.startTime} ${escapeHtml(item.title)}</button>`).join('') || '<span class="small muted">Geen afspraken</span>'}</div></section>`;
  }).join('')}</div>`;
}
