import { ROUTES } from './config.js';
import { appState } from './state.js';
import { dashboardView } from './views/dashboard-view.js';
import { agendaView } from './views/agenda-view.js';
import { shoppingView } from './views/shopping-view.js';
import { tasksView } from './views/tasks-view.js';
import { mealsView } from './views/meals-view.js';
import { inventoryView } from './views/inventory-view.js';
import { expensesView } from './views/expenses-view.js';
import { petsView } from './views/pets-view.js';
import { outingsView } from './views/outings-view.js';
import { settingsView } from './views/settings-view.js';
import { moreView } from './views/more-view.js';
import { activityView } from './views/activity-view.js';
import { templatesView } from './views/templates-view.js';

const views = { home: dashboardView, agenda: agendaView, shopping: shoppingView, tasks: tasksView, meals: mealsView, inventory: inventoryView, expenses: expensesView, pets: petsView, outings: outingsView, activity: activityView, templates: templatesView, settings: settingsView, more: moreView };
const labels = { home: 'Home', agenda: 'Agenda', shopping: 'Boodschappen', tasks: 'Taken', meals: 'Maaltijden', inventory: 'Voorraad', expenses: 'Uitgaven', pets: 'Huisdieren', outings: 'Uitjes', activity: 'Activiteit', templates: 'Sjablonen', settings: 'Instellingen', more: 'Meer' };
const icons = { home: '⌂', agenda: '▣', shopping: '▤', tasks: '✓', meals: '♨', inventory: '◫', expenses: '€', pets: '♣', outings: '⌖', activity: '↻', templates: '▧', settings: '⚙' };

export function buildNavigation() {
  const desktop = document.querySelector('#desktop-nav');
  desktop.innerHTML = ROUTES.map((route) => `<a href="#${route}" data-route="${route}"><span class="nav-icon" aria-hidden="true">${icons[route]}</span>${labels[route]}</a>`).join('');
  const mobileRoutes = ['home', 'agenda', 'shopping', 'tasks'];
  document.querySelector('#mobile-nav').innerHTML = [...mobileRoutes.map((route) => `<a href="#${route}" data-route="${route}"><span class="nav-icon" aria-hidden="true">${icons[route]}</span>${labels[route]}</a>`), `<a href="#more" data-route="more"><span class="nav-icon" aria-hidden="true">•••</span>Meer</a>`].join('');
}

export async function renderRoute() {
  let route = location.hash.slice(1).split('?')[0] || localStorage.getItem('samen-thuis-last-route') || 'home';
  if (!views[route]) route = 'home';
  localStorage.setItem('samen-thuis-last-route', route);
  appState.route = route;
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route || (link.dataset.route === 'more' && !['home','agenda','shopping','tasks'].includes(route))));
  document.querySelector('#page-title').textContent = labels[route];
  document.title = `${labels[route]} · Samen Thuis`;
  const main = document.querySelector('#main-content');
  main.setAttribute('aria-busy', 'true');
  try {
    const view = views[route];
    main.innerHTML = await view.render();
    await view.mount?.(main);
    main.focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    main.innerHTML = `<div class="card"><h2>Deze pagina kon niet worden geladen</h2><p>${error.message || 'Onbekende fout'}</p><button class="button" onclick="location.reload()">Opnieuw proberen</button></div>`;
  } finally { main.setAttribute('aria-busy', 'false'); }
}

export function initializeRouter() { buildNavigation(); window.addEventListener('hashchange', renderRoute); return renderRoute(); }
