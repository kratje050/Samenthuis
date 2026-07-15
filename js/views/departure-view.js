import { appState, repositories, services } from '../state.js';
import { addDays } from '../utils/dates.js';
import { departureStatus } from '../services/departure-service.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { showToast } from '../components/toast.js';

function mapLink(address) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`; }

function checklistItem(appointment, packing, item) {
  const source = (appointment.departureChecklist || []).some((entry) => entry.id === item.id) ? 'appointment' : 'packing';
  return `<li class="list-item"><label class="check-row"><input type="checkbox" data-departure-item="${e(item.id)}" data-appointment-id="${e(appointment.id)}" data-packing-id="${e(packing?.id || '')}" data-source="${source}" ${item.done ? 'checked' : ''}><span>${e(item.text)}${item.essential ? '<small>Essentieel</small>' : ''}</span></label></li>`;
}

function departureCard(appointment, packing) {
  const status = departureStatus(appointment, packing);
  const driver = appState.settings.members.find((member) => member.id === appointment.driverId);
  const address = appointment.address || appointment.location;
  return `<article class="card departure-card ${status.essentialOpen.length ? 'is-overdue' : ''}">
    <div class="card-header"><div><h2>${e(appointment.title)}</h2><p>${e(appointment.date)}${appointment.startTime ? ` · ${e(appointment.startTime)}` : ''}</p></div><span class="badge ${status.ready ? 'low' : status.essentialOpen.length ? 'high' : ''}">${status.ready ? 'Klaar' : `${status.openItems.length} open`}</span></div>
    <div class="departure-countdown"><strong>${status.minutesRemaining === null ? 'Geen vertrektijd' : status.minutesRemaining < 0 ? `${Math.abs(status.minutesRemaining)} min te laat` : `Nog ${status.minutesRemaining} min`}</strong><span>${status.departure ? `Vertrek ${status.departure.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}` : ''}</span></div>
    <dl class="assistant-details">${address ? `<div><dt>Adres</dt><dd>${e(address)}</dd></div>` : ''}${appointment.parkingInfo ? `<div><dt>Parkeren</dt><dd>${e(appointment.parkingInfo)}</dd></div>` : ''}${driver ? `<div><dt>Wie rijdt</dt><dd>${e(driver.name)}</dd></div>` : ''}</dl>
    ${status.essentialOpen.length ? `<div class="medical-disclaimer">Nog essentieel: ${e(status.essentialOpen.map((item) => item.text).join(', '))}</div>` : ''}
    <ul class="item-list">${status.items.slice(0, 12).map((item) => checklistItem(appointment, packing, item)).join('')}</ul>
    <div class="page-actions">${address ? `<a class="button secondary small" href="${e(mapLink(address))}" target="_blank" rel="noopener noreferrer">Adres openen</a>` : ''}${packing ? `<a class="button secondary small" href="#packing?id=${e(packing.id)}">Volledige paklijst</a>` : ''}<a class="button ghost small" href="#agenda">Agenda openen</a></div>
  </article>`;
}

export const departureView = {
  async render() {
    const [appointments, packingLists] = await Promise.all([
      services.agenda.occurrencesBetween(new Date(), addDays(new Date(), 30)),
      repositories.modules.packing.getAll()
    ]);
    const departures = appointments.filter((item) => item.plannedDepartureTime || item.travelMinutes || item.departureChecklist?.length || item.packingListId);
    const cards = departures.map((appointment) => {
      const packing = packingLists.find((item) => item.id === appointment.packingListId || item.appointmentId === appointment.id);
      return departureCard(appointment, packing);
    }).join('');
    return `<section class="page-stack departure-page"><div class="page-header"><div><p class="eyebrow">Plannen</p><h2>Vertrek-assistent</h2><p class="muted">Vertrektijd, adres, parkeren en meeneemchecklist zonder betaalde route-API.</p></div><a class="button" href="#agenda?new=1">＋ Afspraak met vertrekinfo</a></div>${departures.length ? `<div class="content-grid two">${cards}</div>` : emptyState('Geen vertrekinfo ingesteld', 'Open een afspraak en voeg vertrektijd, reistijd of een checklist toe.')}</section>`;
  },

  async mount(root) {
    root.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-departure-item]');
      if (!input) return;
      try {
        if (input.dataset.source === 'appointment') {
          const appointment = await repositories.appointments.getById(input.dataset.appointmentId);
          const departureChecklist = (appointment.departureChecklist || []).map((item) => item.id === input.dataset.departureItem ? { ...item, done: input.checked } : item);
          await repositories.appointments.update(appointment.id, { departureChecklist });
        } else {
          const list = await repositories.modules.packing.getById(input.dataset.packingId);
          const items = (list.items || []).map((item) => item.id === input.dataset.departureItem ? { ...item, done: input.checked } : item);
          await repositories.modules.packing.update(list.id, { items });
        }
        showToast('Vertrekchecklist bijgewerkt.');
        root.innerHTML = await departureView.render();
      } catch (error) { handleError(error); }
    });
  }
};
