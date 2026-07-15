import { appState, repositories } from '../state.js';
import { e, emptyState } from './view-helpers.js';

function block(label, value) {
  if (!value || (Array.isArray(value) && !value.length)) return '';
  return `<div><dt>${e(label)}</dt><dd>${e(Array.isArray(value) ? value.join(' · ') : value)}</dd></div>`;
}

export const emergencyView = {
  async render() {
    const cards = await repositories.modules.emergency.getAll();
    return `<section class="page-stack emergency-page"><div class="page-header no-print"><div><p class="eyebrow">Gezin</p><h2>Noodkaart</h2><p class="muted">Deze gegevens blijven offline beschikbaar. Controleer ze regelmatig zelf.</p></div><div class="page-actions"><a class="button secondary" href="#assistant?module=emergency&new=1">＋ Noodkaart</a><button class="button" data-print-emergency-page>Afdrukken / PDF</button></div></div><div class="medical-disclaimer" role="note">Medische informatie is door het gezin zelf ingevoerd. Samen Thuis controleert of interpreteert deze informatie niet.</div>${cards.length ? `<div class="content-grid two">${cards.map((card) => { const member = appState.settings.members.find((item) => item.id === card.memberId); return `<article class="card emergency-card"><div class="card-header"><div><h2>${e(card.title)}</h2><p>${e(member?.name || 'Algemeen gezinsoverzicht')}</p></div><span class="badge">Gecontroleerd ${e(card.lastCheckedAt)}</span></div><dl>${block('Noodcontacten', card.emergencyContacts)}${block('Huisarts', card.generalPractitioner)}${block('Tandarts', card.dentist)}${block('Dierenarts', card.vet)}${block('Adressen', card.addresses)}${block('Kenteken', card.licensePlate)}${block('Verzekering', card.insurance)}${block('Allergieën', card.allergies)}${block('Medicatie', card.medication)}${block('Instructies', card.instructions)}</dl></article>`; }).join('')}</div>` : emptyState('Nog geen noodkaart', 'Voeg handmatig de belangrijkste noodinformatie toe.')}</section>`;
  },
  async mount(root) { root.querySelector('[data-print-emergency-page]')?.addEventListener('click', () => window.print()); }
};
