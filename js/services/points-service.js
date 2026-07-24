import { addDays, toDateKey } from '../utils/dates.js';

const PRIORITY_BONUS = Object.freeze({ low: -1, normal: 0, high: 3, urgent: 5 });

const KEYWORD_LEVELS = Object.freeze([
  {
    points: 50,
    label: 'project',
    pattern: /\b(verbouwen|verhuizen|renoveren|kamer schilderen|schuur opruimen|zolder opruimen|grote klus)\b/
  },
  {
    points: 30,
    label: 'zwaar',
    pattern: /\b(grote schoonmaak|ramen zemen|tuin onderhouden|garage opruimen|kelder opruimen|hele huis)\b/
  },
  {
    points: 20,
    label: 'groot',
    pattern: /\b(badkamer|bedden verschonen|gras maaien|boodschappen doen|dweilen|oven schoonmaken|koelkast schoonmaken)\b/
  },
  {
    points: 10,
    label: 'normaal',
    pattern: /\b(stofzuigen|was ophangen|was opvouwen|wassen|koken|opruimen|schoonmaken|administratie|huisdier verzorgen)\b/
  },
  {
    points: 5,
    label: 'klein',
    pattern: /\b(vaatwasser|afval|prullenbak|tafel afnemen|plant water|bed opmaken|voer geven)\b/
  }
]);

const UNPOPULAR_PATTERN = /\b(toilet|wc|kattenbak|hondenpoep|afvoer|vuilnis|oven schoonmaken|koelkast schoonmaken)\b/;

function clamp(value, minimum = 3, maximum = 75) {
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value) || 0)));
}

function normalizedTaskText(task = {}) {
  return [task.title, task.description, task.note, task.notes, task.category]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL');
}

function pointsForMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes <= 5) return { points: 3, label: 'ongeveer 5 minuten' };
  if (minutes <= 15) return { points: 5, label: 'ongeveer 15 minuten' };
  if (minutes <= 30) return { points: 10, label: 'ongeveer 30 minuten' };
  if (minutes <= 60) return { points: 20, label: 'ongeveer 1 uur' };
  if (minutes <= 120) return { points: 30, label: 'ongeveer 2 uur' };
  return { points: 50, label: 'meer dan 2 uur' };
}

export function calculateTaskPoints(task = {}) {
  const text = normalizedTaskText(task);
  const duration = pointsForMinutes(Number(task.estimatedMinutes));
  const keywordLevel = KEYWORD_LEVELS.find((level) => level.pattern.test(text));
  const base = duration || keywordLevel || { points: 10, label: 'normale huishoudelijke taak' };
  const priority = String(task.priority || 'normal').toLocaleLowerCase('nl-NL');
  const priorityBonus = PRIORITY_BONUS[priority] ?? 0;
  const unpopularBonus = UNPOPULAR_PATTERN.test(text) ? 3 : 0;
  const points = clamp(base.points + priorityBonus + unpopularBonus);
  const reasons = [base.label];
  if (priorityBonus > 0) reasons.push(`${priority === 'urgent' ? 'dringend' : 'hoge prioriteit'} +${priorityBonus}`);
  if (priorityBonus < 0) reasons.push(`lage prioriteit ${priorityBonus}`);
  if (unpopularBonus) reasons.push(`minder populaire klus +${unpopularBonus}`);
  return { points, reasons, automatic: true };
}

export function withAutomaticTaskPoints(task = {}) {
  const calculation = calculateTaskPoints(task);
  return {
    ...task,
    rewardPoints: calculation.points,
    pointsAutomatic: true,
    pointsReason: calculation.reasons.join(' · ')
  };
}

export function calculateRoutinePoints(routine = {}) {
  const itemCount = Array.isArray(routine.items) ? routine.items.filter((item) => item?.text).length : 0;
  const points = clamp(3 + itemCount * 2, 3, 25);
  return {
    points,
    reasons: [`routine met ${itemCount} stap${itemCount === 1 ? '' : 'pen'}`],
    automatic: true
  };
}

export function weekRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const end = addDays(start, 7);
  return { start, end, startKey: toDateKey(start), endKey: toDateKey(end) };
}

export function summarizeWeeklyPoints({ tasks = [], routines = [], members = [], now = new Date() } = {}) {
  const { start, end, startKey, endKey } = weekRange(now);
  const totals = new Map(members.map((member) => [member.id, {
    memberId: member.id,
    name: member.name,
    color: member.color,
    icon: member.icon,
    points: 0,
    completed: 0
  }]));
  let unassignedPoints = 0;

  for (const task of tasks) {
    if (task.deletedAt || task.status !== 'done' || !task.completedAt) continue;
    const completedAt = new Date(task.completedAt);
    if (Number.isNaN(completedAt.getTime()) || completedAt < start || completedAt >= end) continue;
    const points = Number(task.rewardPoints || calculateTaskPoints(task).points);
    const memberId = task.completedBy || task.assignedTo || '';
    const total = totals.get(memberId);
    if (total) {
      total.points += points;
      total.completed += 1;
    } else {
      unassignedPoints += points;
    }
  }

  for (const routine of routines) {
    const mutedStarter = routine.reminderDisabled && routine.starterKind === 'family-routine';
    if (routine.deletedAt || (routine.status === 'archived' && !mutedStarter)) continue;
    const points = Number(routine.pointValue || calculateRoutinePoints(routine).points);
    for (const entry of routine.completionHistory || []) {
      const date = String(entry.date || '').slice(0, 10);
      if (!date || date < startKey || date >= endKey) continue;
      const memberId = entry.memberId || routine.memberId || '';
      const total = totals.get(memberId);
      if (total) {
        total.points += points;
        total.completed += 1;
      } else {
        unassignedPoints += points;
      }
    }
  }

  const ranking = [...totals.values()].sort((a, b) => b.points - a.points || b.completed - a.completed || a.name.localeCompare(b.name, 'nl'));
  const teamPoints = ranking.reduce((sum, item) => sum + item.points, 0) + unassignedPoints;
  const highest = ranking[0]?.points || 0;
  return {
    ranking,
    teamPoints,
    unassignedPoints,
    leaderIds: highest ? ranking.filter((item) => item.points === highest).map((item) => item.memberId) : [],
    startKey,
    endKey
  };
}
