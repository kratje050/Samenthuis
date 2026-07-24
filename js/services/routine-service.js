import { toDateKey } from '../utils/dates.js';
import { calculateRoutinePoints } from './points-service.js';

export function routineIsActive(routine = {}) {
  const starterMuted = routine.reminderDisabled && routine.starterKind === 'family-routine' && routine.status === 'archived';
  return !routine.paused && (routine.status === 'active' || starterMuted);
}

export function routineAppliesToday(routine, date = new Date()) {
  const dateKey = toDateKey(date);
  return routineIsActive(routine) && (!routine.startDate || routine.startDate <= dateKey) && (!routine.endDate || routine.endDate >= dateKey) && (routine.days || []).includes(String(date.getDay()));
}

export function routineProgress(routine, dateKey = toDateKey()) {
  const completedIds = routine.dailyProgress?.[dateKey] || [];
  const total = (routine.items || []).length;
  return { completedIds, completed: completedIds.length, total, percentage: total ? Math.round(completedIds.length / total * 100) : 0 };
}

export async function toggleRoutineItem(repository, routine, itemId, dateKey = toDateKey()) {
  const current = new Set(routine.dailyProgress?.[dateKey] || []);
  current.has(itemId) ? current.delete(itemId) : current.add(itemId);
  const dailyProgress = { ...(routine.dailyProgress || {}), [dateKey]: [...current] };
  const complete = Boolean((routine.items || []).length && current.size === routine.items.length);
  const history = (routine.completionHistory || []).filter((entry) => entry.date !== dateKey);
  if (complete) history.push({
    date: dateKey,
    completedAt: new Date().toISOString(),
    memberId: routine.memberId || '',
    points: Number(routine.pointValue || calculateRoutinePoints(routine).points)
  });
  return repository.update(routine.id, { dailyProgress, completionHistory: history.slice(-90) });
}
