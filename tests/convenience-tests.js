import { SearchService } from '../js/services/search-service.js';
import { TrashService } from '../js/services/trash-service.js';
import { assert, equal } from './test-utils.js';

function repositoriesWith(overrides = {}) {
  const empty = { getAll: async () => [], restore: async () => null };
  return Object.fromEntries(['appointments','shopping','tasks','meals','inventory','expenses','pets','outings'].map((key) => [key, overrides[key] || empty]));
}

export const convenienceTests = [
  ['globaal zoeken vindt meerdere onderdelen', async () => {
    const service = new SearchService(repositoriesWith({
      appointments: { getAll: async () => [{ id:'a', title:'Dierenarts Navy', location:'Utrecht', notes:'controle', updatedAt:'2026-07-15' }] },
      pets: { getAll: async () => [{ id:'p', name:'Navy', species:'Hond', vet:'Dierenarts Utrecht', updatedAt:'2026-07-14' }] }
    }));
    equal((await service.search('dierenarts utrecht')).length, 2);
  }],
  ['globaal zoeken is accent- en hoofdletterongevoelig', async () => {
    const service = new SearchService(repositoriesWith({ shopping: { getAll: async () => [{ id:'s', productName:'Crème fraîche', category:'Zuivel' }] } }));
    equal((await service.search('CREME')).length, 1);
  }],
  ['centrale prullenbak toont alleen verwijderde items', async () => {
    const service = new TrashService(repositoriesWith({ tasks: { getAll: async () => [{id:'open',title:'Open',deletedAt:null},{id:'deleted',title:'Weg',deletedAt:'2026-07-15T10:00:00Z'}], restore:async()=>null } }));
    const items = await service.getDeletedItems();
    equal(items.length, 1); equal(items[0].title, 'Weg');
  }],
  ['centrale prullenbak gebruikt de juiste repository voor herstel', async () => {
    let restored = '';
    const service = new TrashService(repositoriesWith({ outings: { getAll:async()=>[], restore:async(id)=>{restored=id;return {id}} } }));
    await service.restore('outings','uitje-1'); assert(restored === 'uitje-1');
  }]
];
