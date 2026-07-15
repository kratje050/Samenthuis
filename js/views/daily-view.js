import { appState, repositories, services } from '../state.js';
import { buildDailyOverview, inventoryUrgency } from '../services/daily-overview-service.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { icon } from '../utils/icons.js';

const cards = {
  appointments: ['Afspraken', 'calendar', '#agenda'], departure: ['Vertrekken', 'calendar', '#departure'], packing: ['Meeneemlijsten', 'templates', '#assistant?module=packing'],
  tasks: ['Belangrijke taken', 'tasks', '#tasks'], shopping: ['Boodschappen onderweg', 'cart', '#shopping'], birthdays: ['Verjaardagen', 'birthday', '#agenda'],
  pets: ['Medicatie en dierenarts', 'pets', '#pets'], waste: ['Afvalcontainer', 'inventory', '#assistant?module=waste'], inventory: ['Voorraad en houdbaarheid', 'inventory', '#inventory'],
  notices: ['Belangrijk prikbord', 'activity', '#assistant?module=notice'], routines: ['Routines', 'tasks', '#routines'], subscriptions: ['Betalingen en contracten', 'expenses', '#assistant?module=subscription'],
  loans: ['Terugbrengen', 'activity', '#assistant?module=loan']
};

function itemText(section, item, today) {
  if (section === 'appointments') return [item.title, item.allDay ? 'Hele dag' : item.startTime];
  if (section === 'departure') return [item.title, item.plannedDepartureTime ? `Vertrek ${item.plannedDepartureTime}` : `${item.travelMinutes} min reistijd`];
  if (section === 'packing') return [item.title, `${(item.items || []).filter((entry) => !entry.done).length} nog meenemen`];
  if (section === 'tasks') return [item.title, item.priority === 'urgent' ? 'Dringend' : item.date || item.priority];
  if (section === 'shopping') return [item.productName, `${item.quantity || ''} ${item.unit || ''}`.trim()];
  if (section === 'birthdays') return [item.birthdayName || item.title, 'Vandaag jarig'];
  if (section === 'pets') return [item.title, item.detail];
  if (section === 'waste') return [item.wasteType, item.putOutside ? 'Staat buiten' : item.date === today ? 'Vandaag ophalen' : 'Vanavond buitenzetten'];
  if (section === 'inventory') return [item.productName, inventoryUrgency(item, today)];
  if (section === 'notices') return [item.title, item.message];
  if (section === 'routines') return [item.title, `${(item.items || []).length} stappen`];
  if (section === 'subscriptions') return [item.name, item.trialEndDate ? `Proefperiode tot ${item.trialEndDate}` : item.contractEndDate ? `Contract tot ${item.contractEndDate}` : `Incasso dag ${item.debitDay}`];
  return [item.item, `Retour ${item.expectedReturnDate}`];
}

function renderCard(section, items, today) {
  const [title, iconName, href] = cards[section];
  return `<article class="card daily-card"><div class="card-header"><div class="dashboard-card-title">${icon(iconName)}<h2>${title}</h2></div><a href="${href}">Open</a></div>${items.length ? `<ul class="item-list">${items.slice(0, 6).map((item) => { const [primary, detail] = itemText(section, item, today); return `<li class="list-item"><div class="list-item-main"><strong>${e(primary)}</strong><span class="small muted">${e(detail || '')}</span></div>${section === 'tasks' ? `<button class="mini-action" data-daily-task="${e(item.id)}" aria-label="Taak afvinken">✓</button>` : section === 'shopping' ? `<button class="mini-action" data-daily-shopping="${e(item.id)}" aria-label="Boodschap afvinken">✓</button>` : section === 'waste' ? `<button class="mini-action" data-daily-waste="${e(item.id)}" aria-label="Containerstatus bijwerken">✓</button>` : ''}</li>`; }).join('')}</ul>` : '<p class="muted small">Niets om vandaag te onthouden.</p>'}</article>`;
}

export const dailyView = {
  async render() {
    const overview = await buildDailyOverview({ repositories, agenda: services.agenda, settings: appState.settings });
    return `<section class="page-stack daily-page"><div class="page-header"><div><p class="eyebrow">Vandaag</p><h2>Wat mogen we vandaag niet vergeten?</h2><p class="muted">Eén rustig overzicht van planning, spullen, gezin en thuis.</p></div><a class="button secondary" href="#settings">Kaarten instellen</a></div><div class="content-grid two">${overview.visibleCards.filter((key) => cards[key]).map((key) => renderCard(key, overview[key] || [], overview.today)).join('')}</div></section>`;
  },
  async mount(root) {
    root.addEventListener('click', async (event) => {
      try {
        const task = event.target.closest('[data-daily-task]');
        if (task) { const record = await repositories.tasks.getById(task.dataset.dailyTask); await repositories.tasks.update(record.id, { status: 'done', completedAt: new Date().toISOString() }); }
        const shopping = event.target.closest('[data-daily-shopping]');
        if (shopping) { const record = await repositories.shopping.getById(shopping.dataset.dailyShopping); await repositories.shopping.update(record.id, { checked: true, checkedAt: new Date().toISOString() }); }
        const waste = event.target.closest('[data-daily-waste]');
        if (waste) { const record = await repositories.modules.waste.getById(waste.dataset.dailyWaste); await repositories.modules.waste.update(record.id, record.putOutside ? { broughtInside: true } : { putOutside: true }); }
        if (task || shopping || waste) root.innerHTML = await dailyView.render();
      } catch (error) { handleError(error); }
    });
  }
};
