import { addSavingsTransaction, filterAssistantRecords, validateAssistantRecord } from '../js/services/assistant-service.js';
import { subscriptionSummary, priceHistoryStats } from '../js/services/finance-tools-service.js';
import { routineAppliesToday, routineProgress, toggleRoutineItem } from '../js/services/routine-service.js';
import { packingProgress, presetPackingItems } from '../js/services/packing-service.js';
import { matchLeftoverRecipes } from '../js/services/leftovers-service.js';
import { conflictFields, mergeConflict } from '../js/services/conflict-service.js';
import { validateFamilyFile } from '../js/services/file-service.js';
import { addRewardProgress, completeMaintenance, completeWaste, nextRecurringDate } from '../js/services/household-assistant-service.js';
import { collectFamilyReminders } from '../js/services/family-reminder-service.js';
import { DEPARTURE_PRESETS, presetDepartureItems } from '../js/services/departure-service.js';
import { convertAssistantRecord } from '../js/services/conversion-service.js';
import { applyTemplate } from '../js/services/template-service.js';
import { buildDailyOverview } from '../js/services/daily-overview-service.js';
import { assert, equal, includes } from './test-utils.js';

function fakeRepository(records = []) {
  return {
    records,
    async getAll() { return this.records; },
    async getById(id) { return this.records.find((item) => item.id === id) || null; },
    async update(id, changes) { const current = this.records.find((item) => item.id === id); Object.assign(current, changes); return current; },
    async create(data) { const record = { ...data, id: data.id || `new-${this.records.length + 1}` }; this.records.push(record); return record; }
  };
}

function emptyModules(overrides = {}) {
  const empty = () => fakeRepository([]);
  return { notice: empty(), packing: empty(), waste: empty(), loan: empty(), maintenance: empty(), appliance: empty(), subscription: empty(), routine: empty(), family_mode: empty(), child: empty(), inbox: empty(), bucket_list: empty(), ...overrides };
}

export const assistantTests = [
  ['assistentfilters zoeken accentongevoelig', () => equal(filterAssistantRecords([{ title: 'Crème brûlée' }], { query: 'CREME' }).length, 1)],
  ['assistentfilters combineren type en gezinslid', () => {
    const records = [{ itemType: 'idea', memberIds: ['roy'] }, { itemType: 'note', memberIds: ['roy'] }, { itemType: 'idea', memberIds: ['demy'] }];
    equal(filterAssistantRecords(records, { typeField: 'itemType', type: 'idea', memberField: 'memberIds', memberId: 'roy' }).length, 1);
  }],
  ['verlopen prikbordberichten zijn standaard verborgen', () => {
    const records = [{ expiryDate: '2026-07-14' }, { expiryDate: '2026-07-16' }];
    equal(filterAssistantRecords(records, { module: 'notice', today: '2026-07-15' }).length, 1);
    equal(filterAssistantRecords(records, { module: 'notice', today: '2026-07-15', includeExpired: true }).length, 2);
  }],
  ['verplichte assistentvelden worden gevalideerd', () => {
    let failed = false; try { validateAssistantRecord({ fields: [{ name: 'title', label: 'Titel', required: true }] }, { title: '' }); } catch { failed = true; }
    assert(failed);
  }],
  ['abonnementtotalen rekenen frequenties om', () => {
    const result = subscriptionSummary([{ amount: 12, frequency: 'monthly', status: 'active' }, { amount: 120, frequency: 'yearly', status: 'active' }, { amount: 99, frequency: 'monthly', status: 'ended' }]);
    equal(result.monthly, 22); equal(result.yearly, 264); equal(result.count, 2);
  }],
  ['prijsgeheugen bepaalt laagste en goedkoopste winkel', () => {
    const result = priceHistoryStats([{ productName: 'Melk', store: 'A', quantity: 2, price: 4, date: '2026-01-01' }, { productName: 'Melk', store: 'B', quantity: 1, price: 1.8, date: '2026-01-02' }], 'melk');
    equal(result.lowest, 1.8); equal(result.highest, 2); equal(result.cheapestStore, 'B');
  }],
  ['spaardoel verwerkt storting en markeert behaald', async () => {
    const repository = fakeRepository([{ id: 's', currentAmount: 90, targetAmount: 100, status: 'active', transactions: [] }]);
    const result = await addSavingsTransaction(repository, repository.records[0], 10, 'Test');
    equal(result.currentAmount, 100); equal(result.status, 'achieved'); equal(result.transactions.length, 1);
  }],
  ['routine start iedere dag schoon en bewaart historie', async () => {
    const routine = { id: 'r', status: 'active', days: ['3'], items: [{ id: 'a' }, { id: 'b' }], dailyProgress: {} };
    assert(routineAppliesToday(routine, new Date(2026, 6, 15)));
    const repository = fakeRepository([routine]); await toggleRoutineItem(repository, routine, 'a', '2026-07-15'); await toggleRoutineItem(repository, routine, 'b', '2026-07-15');
    equal(routineProgress(routine, '2026-07-15').percentage, 100); equal(routine.completionHistory.length, 1); equal(routineProgress(routine, '2026-07-16').percentage, 0);
  }],
  ['paklijstpresets en voortgang werken', () => { const items = presetPackingItems('Zwemmen'); assert(items.length >= 4); items[0].done = true; equal(packingProgress({ items }).completed, 1); assert(items.every((item) => item.essential)); }],
  ['vertrekassistent bevat alle praktische herbruikbare voorbeelden', () => {
    const names = Object.keys(DEPARTURE_PRESETS);
    ['Opvang','School','Zwemmen','Fotoshoot','Huisarts','Ziekenhuis','Dierenarts','Familiebezoek','Dagje uit','Weekend weg','Vakantie'].forEach((name) => assert(names.includes(name), `${name} ontbreekt`));
    const items = presetDepartureItems('Ziekenhuis'); assert(items.length >= 4); assert(items.some((item) => item.essential));
  }],
  ['inboxnotitie wordt eenmaal aan het gekoppelde kindprofiel toegevoegd', async () => {
    const child = fakeRepository([{ id: 'child-1', memberId: 'miley', notes: '' }]);
    const inbox = fakeRepository([{ id: 'inbox-1', title: 'School', content: 'Gymtas mee', memberIds: ['miley'], convertedRecords: {} }]);
    const repositories = { modules: { child, inbox } };
    const first = await convertAssistantRecord({ module: 'inbox', record: inbox.records[0], target: 'child_note', repositories });
    includes(child.records[0].notes, 'Gymtas mee'); equal(inbox.records[0].status, 'archived'); assert(!first.duplicate);
    const second = await convertAssistantRecord({ module: 'inbox', record: inbox.records[0], target: 'child_note', repositories }); assert(second.duplicate);
  }],
  ['inpaklijstsjabloon maakt een echte paklijst en geen losse taken', async () => {
    const packing = fakeRepository([]); const tasks = fakeRepository([]);
    const count = await applyTemplate({ title: 'Weekend', templateType: 'packing', items: [{ name: 'Tandenborstel' }, { name: 'Pyjama' }] }, { modules: { packing }, tasks });
    equal(count, 2); equal(packing.records.length, 1); equal(packing.records[0].items.length, 2); equal(tasks.records.length, 0);
  }],
  ['actieve gezinsmodus bepaalt zichtbare dagkaarten en routines', async () => {
    const modules = emptyModules({
      family_mode: fakeRepository([{ id: 'mode', title: 'Werkdag', active: true, visibleCards: ['Taken', 'Prikbord'], hiddenInformation: ['Prikbord'], activeRoutineIds: ['routine-2'] }]),
      routine: fakeRepository([{ id: 'routine-1', status: 'active', paused: false, days: ['3'] }, { id: 'routine-2', status: 'active', paused: false, days: ['3'] }])
    });
    const repositories = { tasks: fakeRepository([]), shopping: fakeRepository([]), inventory: fakeRepository([]), pets: fakeRepository([]), modules };
    const agenda = { async occurrencesBetween() { return []; } };
    const result = await buildDailyOverview({ repositories, agenda, settings: { dailyOverviewCards: ['appointments','tasks','notices'] }, now: new Date(2026, 6, 15, 10) });
    equal(result.visibleCards.join(','), 'tasks'); equal(result.routines.length, 1); equal(result.routines[0].id, 'routine-2'); equal(result.activeMode.id, 'mode');
  }],
  ['restjesplanner toont ontbrekende ingrediënten', () => {
    const result = matchLeftoverRecipes([{ id: 'r', name: 'Pasta', ingredients: 'Pasta\nTomaat\nKaas' }], [{ id: 'p', productName: 'Pasta' }, { id: 't', productName: 'Tomaat' }], ['p','t']);
    equal(result[0].missing.length, 1); equal(result[0].missing[0], 'Kaas');
  }],
  ['conflict toont verschillen en voegt veldkeuzes samen', () => {
    const data = { local: { id: 'x', title: 'Lokaal', notes: 'A' }, remote: { id: 'x', title: 'Centraal', notes: 'B' } };
    equal(conflictFields(data).length, 2); const merged = mergeConflict(data, { title: 'local', notes: 'remote' }); equal(merged.title, 'Lokaal'); equal(merged.notes, 'B');
  }],
  ['bestandsvalidatie weigert onveilig type en te groot document', () => {
    let unsafe = false; try { validateFamilyFile({ size: 10, type: 'text/html' }); } catch { unsafe = true; } assert(unsafe);
    let large = false; try { validateFamilyFile({ size: 6 * 1024 * 1024, type: 'application/pdf' }); } catch { large = true; } assert(large);
    assert(validateFamilyFile({ size: 1024, type: 'image/webp' }, 'image'));
  }],
  ['herhaaldata ondersteunen dagen weken maanden en jaren', () => {
    equal(nextRecurringDate('2026-07-15', 'dagelijks'), '2026-07-16'); equal(nextRecurringDate('2026-07-15', 'iedere 2 weken'), '2026-07-29');
    equal(nextRecurringDate('2026-01-31', 'maandelijks'), '2026-02-28'); equal(nextRecurringDate('2024-02-29', 'jaarlijks'), '2025-02-28');
  }],
  ['onderhoud afronden bewaart historie en plant volgende datum', async () => {
    const repository = fakeRepository([{ id: 'm', nextDate: '2026-07-15', recurrence: 'maandelijks', history: [], status: 'planned' }]);
    const result = await completeMaintenance(repository, repository.records[0], new Date(2026, 6, 15)); equal(result.nextDate, '2026-08-15'); equal(result.history.length, 1);
  }],
  ['afval afronden maakt precies één volgende herhaling', async () => {
    const repository = fakeRepository([{ id: 'w', wasteType: 'Papier', date: '2026-07-15', recurrence: 'iedere 2 weken', putOutside: true, broughtInside: false }]);
    await completeWaste(repository, repository.records[0]); equal(repository.records.length, 2); equal(repository.records[1].date, '2026-07-29');
  }],
  ['beloning vereist goedkeuring wanneer ingesteld', async () => {
    const repository = fakeRepository([{ id: 'b', progress: 0, goal: 2, status: 'active', approvalRequired: true }]);
    let failed = false; try { await addRewardProgress(repository, repository.records[0]); } catch { failed = true; } assert(failed);
    const result = await addRewardProgress(repository, repository.records[0], 2, 'roy'); equal(result.status, 'achieved');
  }],
  ['gezinsherinneringen verzamelen afval routine en incasso', async () => {
    const modules = emptyModules({
      waste: fakeRepository([{ id:'w', wasteType:'GFT', date:'2026-07-16', reminderTime:'20:00', putOutside:false }]),
      routine: fakeRepository([{ id:'r', title:'Avond', status:'active', paused:false, days:['3'], startTime:'19:00' }]),
      subscription: fakeRepository([{ id:'s', name:'Internet', status:'active', debitDay:15 }])
    });
    const result = await collectFamilyReminders({ modules }, new Date(2026, 6, 15, 20, 0)); equal(result.length, 3); includes(result.map((item) => item.title).join(' '), 'GFT');
  }]
];
