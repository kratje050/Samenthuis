import { toDateKey } from '../utils/dates.js';

export function routineAppliesToday(routine, date = new Date()) {
  const dateKey = toDateKey(date);
  return routine.status === 'active' && !routine.paused && (!routine.startDate || routine.startDate <= dateKey) && (!routine.endDate || routine.endDate >= dateKey) && (routine.days || []).includes(String(date.getDay()));
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
  const history = [...(routine.completionHistory || [])];
  if ((routine.items || []).length && current.size === routine.items.length && !history.some((entry) => entry.date === dateKey)) history.push({ date: dateKey, completedAt: new Date().toISOString() });
  return repository.update(routine.id, { dailyProgress, completionHistory: history.slice(-90) });
}
