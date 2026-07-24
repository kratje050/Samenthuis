import {
  STARTER_LIBRARY_VERSION,
  buildStarterChallenges,
  buildStarterRoutines,
  buildStarterTasks,
  buildStarterTemplates,
  challengePeriod
} from '../data/family-content-library.js';
import { calculateRoutinePoints } from './points-service.js';

async function seedMissing(repository, records, existing, updatedBy = 'starter-library') {
  const existingIds = new Set(existing.map((item) => item.id));
  const existingKeys = new Set(existing.map((item) => item.starterKey).filter(Boolean));
  let created = 0;
  for (const record of records) {
    if (existingIds.has(record.id) || existingKeys.has(record.starterKey)) continue;
    await repository.create(record, updatedBy);
    created += 1;
  }
  return created;
}

async function refreshChallengeCycles(repository, existing, now) {
  let refreshed = 0;
  for (const record of existing) {
    if (!record.starterContent || record.starterKind !== 'family-challenge' || record.deletedAt) continue;
    if (!record.cycle || ['archived', 'paused'].includes(record.status)) continue;
    const period = challengePeriod(record.cycle, now);
    if (record.periodKey === period.periodKey) continue;
    const history = [...(record.cycleHistory || []), {
      periodKey: record.periodKey || '',
      progress: Number(record.progress || 0),
      goal: Number(record.goal || 0),
      achieved: record.status === 'achieved',
      endedAt: record.endDate || ''
    }].filter((item) => item.periodKey).slice(-12);
    await repository.update(record.id, {
      startDate: period.startDate,
      endDate: period.endDate,
      periodKey: period.periodKey,
      progress: 0,
      status: 'active',
      cycleHistory: history
    }, 'starter-library');
    refreshed += 1;
  }
  return refreshed;
}

async function muteExistingStarters(repository, records, kind) {
  let muted = 0;
  for (const record of records) {
    if (record.deletedAt || record.starterKind !== kind || Number(record.starterMutedVersion || 0) >= 1) continue;
    await repository.update(record.id, {
      reminderDisabled: true,
      starterMutedVersion: 1,
      status: record.status === 'done' ? 'done' : 'archived'
    }, 'starter-library');
    muted += 1;
  }
  return muted;
}

export async function ensureStarterFamilyContent(repositories, settings = {}, now = new Date()) {
  if (!repositories?.tasks || !repositories?.templates || !repositories?.modules?.reward || !repositories?.modules?.routine) {
    throw new Error('De gezinsbibliotheek kan niet worden klaargezet: repositories ontbreken.');
  }
  const members = settings.members || [];
  const [tasks, templates, rewards, routines] = await Promise.all([
    repositories.tasks.getAll({ includeDeleted: true }),
    repositories.templates.getAll({ includeDeleted: true }),
    repositories.modules.reward.getAll({ includeDeleted: true }),
    repositories.modules.routine.getAll({ includeDeleted: true })
  ]);

  const routineRecords = buildStarterRoutines(members).map((record) => {
    const calculation = calculateRoutinePoints(record);
    return { ...record, pointValue: calculation.points, pointsAutomatic: true, pointsReason: calculation.reasons.join(' · ') };
  });

  const muted = {
    tasks: await muteExistingStarters(repositories.tasks, tasks, 'family-task'),
    routines: await muteExistingStarters(repositories.modules.routine, routines, 'family-routine')
  };
  const created = {
    tasks: await seedMissing(repositories.tasks, buildStarterTasks(members, now), tasks),
    templates: await seedMissing(repositories.templates, buildStarterTemplates(), templates),
    routines: await seedMissing(repositories.modules.routine, routineRecords, routines),
    challenges: await seedMissing(repositories.modules.reward, buildStarterChallenges(members, now), rewards)
  };
  const refreshedChallenges = await refreshChallengeCycles(repositories.modules.reward, rewards, now);

  let savedSettings = null;
  if (repositories.settings?.save && Number(settings.starterLibraryVersion || 0) < STARTER_LIBRARY_VERSION) {
    savedSettings = await repositories.settings.save({
      starterLibraryVersion: STARTER_LIBRARY_VERSION,
      starterLibraryInstalledAt: new Date().toISOString()
    }, 'starter-library');
  }

  return {
    created,
    muted,
    refreshedChallenges,
    totalCreated: Object.values(created).reduce((sum, count) => sum + count, 0),
    settings: savedSettings
  };
}
