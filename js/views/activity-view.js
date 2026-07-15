import { repositories } from '../state.js';
import { e, emptyState } from './view-helpers.js';

const entityLabels = {
  appointment: 'Agenda', shopping: 'Boodschappen', task: 'Taken', meal: 'Maaltijden', inventory: 'Voorraad',
  expense: 'Uitgaven', pet: 'Huisdieren', outing: 'Uitjes', settings: 'Instellingen', template: 'Sjablonen'
};
const actionLabels = { create: 'toegevoegd', update: 'aangepast', delete: 'verwijderd' };
let actorFilter = '';
let entityFilter = '';

async function refreshActivity() {
  const root = document.querySelector('#activity-list');
  if (!root) return;
  const records = await repositories.activity.recent(150);
  const filtered = records.filter((item) => (!actorFilter || item.actorId === actorFilter) && (!entityFilter || item.entityType === entityFilter));
  root.innerHTML = filtered.length ? `<ul class="item-list">${filtered.map((item) => `<li class="list-item"><div class="list-item-main"><strong class="list-item-title">${e(item.actorName || 'Een gezinslid')} heeft “${e(item.title)}” ${e(actionLabels[item.action] || 'gewijzigd')}</strong><div class="list-item-meta"><span class="badge">${e(entityLabels[item.entityType] || item.entityType)}</span><time datetime="${e(item.occurredAt)}">${e(new Date(item.occurredAt).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }))}</time></div></div></li>`).join('')}</ul>` : emptyState('Nog geen activiteit', 'Nieuwe wijzigingen van het gezin verschijnen hier automatisch.');
}

export const activityView = {
  async render() {
    const records = await repositories.activity.recent(150);
    const actors = [...new Map(records.map((item) => [item.actorId, item.actorName || 'Een gezinslid'])).entries()];
    const entities = [...new Set(records.map((item) => item.entityType))].sort();
    return `<section class="page-stack"><div class="page-header"><div><h2>Gezinsactiviteit</h2><p class="muted">Bekijk wie iets heeft toegevoegd, aangepast of verwijderd.</p></div></div><div class="toolbar"><div class="field grow"><label for="activity-actor">Gezinslid</label><select id="activity-actor"><option value="">Iedereen</option>${actors.map(([id,name])=>`<option value="${e(id)}">${e(name)}</option>`).join('')}</select></div><div class="field grow"><label for="activity-entity">Onderdeel</label><select id="activity-entity"><option value="">Alle onderdelen</option>${entities.map((entity)=>`<option value="${e(entity)}">${e(entityLabels[entity] || entity)}</option>`).join('')}</select></div></div><div id="activity-list"></div></section>`;
  },
  async mount(root) {
    root.querySelector('#activity-actor').value = actorFilter;
    root.querySelector('#activity-entity').value = entityFilter;
    root.querySelector('#activity-actor').addEventListener('change', async (event) => { actorFilter = event.target.value; await refreshActivity(); });
    root.querySelector('#activity-entity').addEventListener('change', async (event) => { entityFilter = event.target.value; await refreshActivity(); });
    await refreshActivity();
  }
};
