import { DEFAULT_MEMBERS } from '../js/config.js';
import {
  STARTER_CONTENT_COUNTS,
  buildStarterChallenges,
  buildStarterRoutines,
  buildStarterTasks,
  buildStarterTemplates,
  challengePeriod
} from '../js/data/family-content-library.js';
import { ensureStarterFamilyContent } from '../js/services/family-content-service.js';
import { routineAppliesToday } from '../js/services/routine-service.js';
import {
  applyAutomaticTaskChallenges,
  automaticChallengeAmount,
  rollbackAutomaticTaskChallenges
} from '../js/services/challenge-progress-service.js';
import { assert, equal } from './test-utils.js';

class MemoryRepository {
  constructor(records = []) { this.records = records.map((item) => structuredClone(item)); }
  async getAll({ includeDeleted = false } = {}) {
    return this.records.filter((item) => includeDeleted || !item.deletedAt).map((item) => structuredClone(item));
  }
  async getById(id, { includeDeleted = false } = {}) {
    const item = this.records.find((record) => record.id === id);
    return item && (includeDeleted || !item.deletedAt) ? structuredClone(item) : null;
  }
  async create(record) {
    const created = { ...structuredClone(record), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, deletedAt: null };
    this.records.push(created);
    return structuredClone(created);
  }
  async update(id, changes) {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) throw new Error('Niet gevonden');
    this.records[index] = { ...this.records[index], ...structuredClone(changes), version: Number(this.records[index].version || 0) + 1 };
    return structuredClone(this.records[index]);
  }
}

function fakeRepositories(initial = {}) {
  const settings = new MemoryRepository([{ id: 'settings', members: DEFAULT_MEMBERS }]);
  settings.save = async (changes) => settings.update('settings', changes);
  return {
    tasks: new MemoryRepository(initial.tasks),
    templates: new MemoryRepository(initial.templates),
    settings,
    modules: {
      reward: new MemoryRepository(initial.rewards),
      routine: new MemoryRepository(initial.routines)
    }
  };
}

export const familyContentTests = [
  ['gezinsbibliotheek bevat veel taken, taaksets, routines en uitdagingen', () => {
    assert(STARTER_CONTENT_COUNTS.tasks >= 70, 'Te weinig vaste taken');
    assert(STARTER_CONTENT_COUNTS.templateItems >= 100, 'Te weinig taakideeën in sjablonen');
    assert(STARTER_CONTENT_COUNTS.routines >= 8, 'Te weinig routines');
    assert(STARTER_CONTENT_COUNTS.challenges >= 36, 'Te weinig uitdagingen');
  }],
  ['starterrecords hebben unieke geldige UUIDs en bruikbare herhaling', () => {
    const records = [
      ...buildStarterTasks(DEFAULT_MEMBERS, new Date(2026, 6, 24)),
      ...buildStarterTemplates(),
      ...buildStarterRoutines(DEFAULT_MEMBERS),
      ...buildStarterChallenges(DEFAULT_MEMBERS, new Date(2026, 6, 24))
    ];
    const ids = records.map((item) => item.id);
    equal(new Set(ids).size, ids.length);
    ids.forEach((id) => assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i.test(id), `Ongeldige UUID: ${id}`));
    const starterTasks = records.filter((item) => item.starterKind === 'family-task');
    const starterRoutines = records.filter((item) => item.starterKind === 'family-routine');
    assert(starterTasks.every((item) => item.recurrence !== 'none'));
    assert(starterTasks.every((item) => item.reminderDisabled), 'Startertaken mogen geen meldingenstorm veroorzaken');
    assert(starterTasks.every((item) => item.status === 'archived'), 'Startertaken moeten ook door de bestaande servermelding worden overgeslagen');
    assert(starterRoutines.every((item) => item.reminderDisabled), 'Starterroutines mogen geen meldingenstorm veroorzaken');
    assert(starterRoutines.every((item) => item.status === 'archived'), 'Starterroutines moeten ook door de bestaande servermelding worden overgeslagen');
    assert(routineAppliesToday(starterRoutines[0], new Date(2026, 6, 24)), 'Een stille starterroutine moet wel uitvoerbaar blijven');
  }],
  ['gezinsbibliotheek wordt idempotent ingevoerd en respecteert verwijderde starters', async () => {
    const repositories = fakeRepositories();
    const first = await ensureStarterFamilyContent(repositories, { members: DEFAULT_MEMBERS }, new Date(2026, 6, 24));
    equal(first.created.tasks, STARTER_CONTENT_COUNTS.tasks);
    equal(first.created.challenges, STARTER_CONTENT_COUNTS.challenges);
    repositories.tasks.records[0].deletedAt = new Date().toISOString();
    repositories.tasks.records[1] = { ...repositories.tasks.records[1], starterMutedVersion: 0, reminderDisabled: false, status: 'open' };
    const second = await ensureStarterFamilyContent(repositories, { members: DEFAULT_MEMBERS, starterLibraryVersion: 1 }, new Date(2026, 6, 24));
    equal(second.totalCreated, 0);
    equal(second.muted.tasks, 1);
    equal(repositories.tasks.records[1].status, 'archived');
    equal(repositories.tasks.records.length, STARTER_CONTENT_COUNTS.tasks);
  }],
  ['wekelijkse en maandelijkse uitdaging krijgen de juiste periode', () => {
    const now = new Date(2026, 6, 24);
    const weekly = challengePeriod('weekly', now);
    const monthly = challengePeriod('monthly', now);
    equal(weekly.startDate, '2026-07-20');
    equal(weekly.endDate, '2026-07-26');
    equal(monthly.startDate, '2026-07-01');
    equal(monthly.endDate, '2026-07-31');
  }],
  ['automatische uitdaging herkent punten, categorie, snelheid en gezinslid', () => {
    const task = { title: 'Badkamer schoonmaken', category: 'Huishouden', priority: 'high', estimatedMinutes: 15, completedBy: DEFAULT_MEMBERS[0].id, completedAt: '2026-07-24T10:00:00.000Z', rewardPoints: 23 };
    const base = { memberIds: [DEFAULT_MEMBERS[0].id], startDate: '2026-07-20', endDate: '2026-07-26' };
    equal(automaticChallengeAmount({ ...base, autoRule: { metric: 'points' } }, task), 23);
    equal(automaticChallengeAmount({ ...base, autoRule: { metric: 'category', categories: ['Huishouden'] } }, task), 1);
    equal(automaticChallengeAmount({ ...base, autoRule: { metric: 'quick', maxMinutes: 15 } }, task), 1);
    equal(automaticChallengeAmount({ ...base, autoRule: { metric: 'keywords', keywords: ['badkamer'] } }, task), 1);
    equal(automaticChallengeAmount({ ...base, memberIds: [DEFAULT_MEMBERS[1].id], autoRule: { metric: 'tasks' } }, task), 0);
  }],
  ['taak werkt meerdere passende uitdagingen bij en heropenen draait dit terug', async () => {
    const repository = new MemoryRepository([
      { id: 'a', title: 'Punten', status: 'active', progress: 0, goal: 50, periodKey: 'weekly:2026-07-20', startDate: '2026-07-20', endDate: '2026-07-26', memberIds: [], autoRule: { metric: 'points' } },
      { id: 'b', title: 'Badkamer', status: 'active', progress: 0, goal: 1, periodKey: 'weekly:2026-07-20', startDate: '2026-07-20', endDate: '2026-07-26', memberIds: [], autoRule: { metric: 'keywords', keywords: ['badkamer'] } }
    ]);
    const task = { title: 'Badkamer schoonmaken', completedAt: '2026-07-24T10:00:00.000Z', rewardPoints: 23 };
    const awards = await applyAutomaticTaskChallenges({ repository, task, pointValue: 23 });
    equal(awards.length, 2);
    equal((await repository.getById('a')).progress, 23);
    equal((await repository.getById('b')).status, 'achieved');
    equal(await rollbackAutomaticTaskChallenges(repository, awards), 2);
    equal((await repository.getById('a')).progress, 0);
    equal((await repository.getById('b')).status, 'active');
  }]
];
