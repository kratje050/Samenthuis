import { escapeHtml } from '../utils/sanitization.js';

export function renderDayCalendar(occurrences, members = []) {
  if (!occurrences.length) return '<div class="empty-state"><strong>Een rustige dag</strong>Er staan nog geen afspraken op deze dag.</div>';
  return `<div class="day-agenda">${occurrences.map((item) => `<article class="list-item ${item.completed ? 'is-complete' : ''}">
    <div class="agenda-time">${item.allDay ? 'Hele dag' : escapeHtml(item.startTime || '')}</div><div class="list-item-main"><h3 class="list-item-title">${escapeHtml(item.title)}</h3>
    <div class="list-item-meta"><span>${escapeHtml(item.occurrenceDate || item.date)}</span><span>${escapeHtml(item.category || 'Overig')}</span>${item.location ? `<span>⌖ ${escapeHtml(item.location)}</span>` : ''}${(item.members || []).map((id) => `<span>${escapeHtml(members.find((m) => m.id === id)?.name || id)}</span>`).join('')}</div></div>
    <div class="list-actions"><button class="mini-action" data-complete-appointment="${item.id}" aria-label="${item.completed ? 'Heropen' : 'Afronden'}">${item.completed ? '↶' : '✓'}</button><button class="mini-action" data-copy-appointment="${item.id}" aria-label="Kopiëren">⧉</button><button class="mini-action" data-edit-appointment="${item.id}" aria-label="Aanpassen">✎</button><button class="mini-action danger" data-delete-appointment="${item.id}" aria-label="Verwijderen">⌫</button></div></article>`).join('')}</div>`;
}
