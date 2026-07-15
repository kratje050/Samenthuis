import { icon } from '../utils/icons.js';

const items = [
  ['meals', 'meals', 'Maaltijden', 'Plan de week en bewaar recepten.'],
  ['inventory', 'inventory', 'Voorraad', 'Bekijk tekorten en houdbaarheid.'],
  ['expenses', 'expenses', 'Uitgaven', 'Houd handmatig de maand bij.'],
  ['pets', 'pets', 'Huisdieren', 'Medicatie, vaccinaties en dierenarts.'],
  ['outings', 'outings', 'Uitjes', 'Bewaar plannen, vakanties en ideeën.'],
  ['activity', 'activity', 'Activiteit', 'Bekijk wie iets heeft gewijzigd.'],
  ['templates', 'templates', 'Sjablonen', 'Herbruik boodschappen-, taken- en inpaklijsten.'],
  ['settings', 'settings', 'Instellingen', 'Gezinsleden, back-up en voorkeuren.']
];

export const moreView = {
  async render() {
    return `<section class="page-stack more-page"><p class="muted">Alle andere onderdelen van Gezin &amp; Co.</p><div class="more-grid">${items.map(([route, iconName, title, description]) => `<a class="more-tile" href="#${route}"><span>${icon(iconName)}</span><div><h2>${title}</h2><p>${description}</p></div>${icon('chevron-right')}</a>`).join('')}</div></section>`;
  }
};
