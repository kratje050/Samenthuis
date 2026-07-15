import { modulesByGroup } from '../modules/assistant-modules.js';
import { icon } from '../utils/icons.js';

const existing = [
  ['Vandaag', 'daily', 'home', 'Vandaag niet vergeten', 'Afspraken, routines, spullen en herinneringen op één pagina.'],
  ['Vandaag', 'routines', 'tasks', 'Routines uitvoeren', 'Werk de routine van vandaag stap voor stap af.'],
  ['Plannen', 'departure', 'calendar', 'Vertrek-assistent', 'Controleer vertrektijd, adres en essentiële spullen.'],
  ['Plannen', 'packing', 'templates', 'Paklijsten uitvoeren', 'Vink gekoppelde paklijsten rustig af.'],
  ['Plannen', 'meals', 'meals', 'Maaltijden', 'Plan de week en bewaar recepten.'],
  ['Plannen', 'leftovers', 'meals', 'Restjesplanner', 'Vind recepten met producten die al in huis zijn.'],
  ['Thuis', 'inventory', 'inventory', 'Voorraad', 'Bekijk tekorten en houdbaarheid.'],
  ['Geld', 'expenses', 'expenses', 'Uitgaven', 'Houd handmatig de maand bij.'],
  ['Gezin', 'pets', 'pets', 'Huisdieren', 'Medicatie, vaccinaties en dierenarts.'],
  ['Plannen', 'outings', 'outings', 'Uitjes', 'Bewaar plannen, vakanties en ideeën.'],
  ['Gezin', 'activity', 'activity', 'Activiteit', 'Bekijk wie iets heeft gewijzigd.'],
  ['Gezin', 'emergency', 'settings', 'Offline noodkaart', 'Open of print belangrijke gezinsinformatie.'],
  ['Plannen', 'templates', 'templates', 'Sjablonen', 'Herbruik boodschappen-, taken- en inpaklijsten.']
];

function tile(href, iconName, title, description) {
  return `<a class="more-tile" href="${href}"><span>${icon(iconName)}</span><div><h3>${title}</h3><p>${description}</p></div>${icon('chevron-right')}</a>`;
}

export const moreView = {
  async render() {
    const groups = modulesByGroup().map(({ group, modules }) => {
      const current = existing.filter(([itemGroup]) => itemGroup === group).map(([, route, iconName, title, description]) => tile(`#${route}`, iconName, title, description));
      const assistant = modules.map(([key, definition]) => tile(`#assistant?module=${key}`, definition.icon, definition.title, definition.description));
      return `<section class="more-section"><h2>${group}</h2><div class="more-grid">${[...current, ...assistant].join('')}</div></section>`;
    }).join('');
    return `<section class="page-stack more-page"><div><h2>Alles voor jullie gezin</h2><p class="muted">De onderdelen zijn rustig gegroepeerd. Alles werkt offline en gebruikt dezelfde gezinsopslag.</p></div>${groups}<section class="more-section"><h2>Instellingen</h2><div class="more-grid">${tile('#settings', 'settings', 'Instellingen', 'Gezinsleden, privacy, back-up, synchronisatie en voorkeuren.')}</div></section></section>`;
  }
};
