import { escapeHtml } from '../utils/sanitization.js';
import { formatDate } from '../utils/dates.js';
import { icon } from '../utils/icons.js';

function groupByDate(occurrences) {
  return occurrences.reduce((groups, item) => {
    const key = item.occurrenceDate || item.date;
    (groups[key] ||= []).push(item);
    return groups;
  }, {});
}

export function renderDayCalendar(occurrences, members = [], colorForCategory = () => '#c65d58') {
  if (!occurrences.length) return '<div class="empty-state"><strong>Een rustige dag</strong>Er staan nog geen afspraken op deze dag.</div>';
  const groups = groupByDate(occurrences);
  return `<div class="day-agenda">${Object.entries(groups).map(([date, items]) => `<section class="agenda-day-group">
    <h3 class="agenda-day-title">${escapeHtml(formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
    <div class="agenda-group-card">${items.map((item) => `<article class="agenda-row ${item.completed ? 'is-complete' : ''}" style="--event-color:${colorForCategory(item.category)}">
      <span class="agenda-row-dot" aria-hidden="true"></span>
      <time class="agenda-row-time">${item.allDay ? 'Dag' : escapeHtml(item.startTime || '')}</time>
      <button class="agenda-row-main" type="button" data-edit-appointment="${item.id}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.location || item.category || '')}${(item.members || []).length ? ` · ${(item.members || []).map((id) => escapeHtml(members.find((member) => member.id === id)?.name || '')).filter(Boolean).join(', ')}` : ''}</small></button>
      <details class="agenda-row-actions"><summary aria-label="Acties">${icon('more')}</summary><div><button type="button" data-complete-appointment="${item.id}">${item.completed ? 'Heropen' : 'Afronden'}</button><button type="button" data-copy-appointment="${item.id}">Kopiëren</button><button type="button" class="danger" data-delete-appointment="${item.id}">Verwijderen</button></div></details>
    </article>`).join('')}</div>
  </section>`).join('')}</div>`;
}
