import { openModal, closeModal } from './modal.js';
import { icon } from '../utils/icons.js';

const actions = [
  ['agenda?new=1', 'calendar', 'Nieuwe afspraak', 'Plan iets voor één of meer gezinsleden.'],
  ['shopping?new=1', 'cart', 'Boodschap toevoegen', 'Zet direct een product op de lijst.'],
  ['tasks?new=1', 'tasks', 'Nieuwe taak', 'Verdeel een huishoudelijke taak.'],
  ['meals?new=1', 'meals', 'Maaltijd plannen', 'Vul vandaag of een andere dag in.'],
  ['expenses?new=1', 'expenses', 'Uitgave toevoegen', 'Leg een handmatige uitgave vast.']
];

export function openQuickAdd() {
  const modal = openModal({
    title: 'Snel toevoegen', onSubmit: null,
    content: `<div class="quick-actions">${actions.map(([route, iconName, title, description]) => `<a class="list-item" href="#${route}"><span class="quick-action-icon" aria-hidden="true">${icon(iconName)}</span><span class="list-item-main"><strong class="list-item-title">${title}</strong><span class="list-item-meta">${description}</span></span>${icon('chevron-right')}</a>`).join('')}</div>`
  });
  modal.querySelector('.quick-actions').addEventListener('click', (event) => { if (event.target.closest('a')) closeModal(); });
}
