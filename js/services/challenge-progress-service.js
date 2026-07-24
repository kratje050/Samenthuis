import { calculateTaskPoints } from './points-service.js';
import { toDateKey } from '../utils/dates.js';

function normalized(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL');
}

function taskText(task = {}) {
  return normalized([task.title, task.description, task.note, task.notes, task.category].filter(Boolean).join(' '));
}

function taskDateKey(task = {}) {
  const completedAt = task.completedAt ? new Date(task.completedAt) : new Date();
  return Number.isNaN(completedAt.getTime()) ? toDateKey() : toDateKey(completedAt);
}

function belongsToChallenge(challenge, task) {
  const memberIds = challenge.memberIds || [];
  if (!memberIds.length) return true;
  const memberId = task.completedBy || task.assignedTo || '';
  if (!memberId && challenge.audience === 'family') return true;
  return Boolean(memberId && memberIds.includes(memberId));
}

function challengeIsCurrent(challenge, task) {
  const date = taskDateKey(task);
  return (!challenge.startDate || challenge.startDate <= date) && (!challenge.endDate || challenge.endDate >= date);
}

export function automaticChallengeAmount(challenge, task, pointValue = null) {
  const rule = challenge?.autoRule;
  if (!rule || !belongsToChallenge(challenge, task) || !challengeIsCurrent(challenge, task)) return 0;
  if (rule.metric === 'points') return Math.max(0, Number(pointValue ?? task.rewardPoints ?? calculateTaskPoints(task).points));
  if (rule.metric === 'tasks') return 1;
  if (rule.metric === 'quick') {
    const minutes = Number(task.estimatedMinutes || 0);
    return minutes > 0 && minutes <= Number(rule.maxMinutes || 15) ? 1 : 0;
  }
  if (rule.metric === 'priority') return (rule.priorities || []).includes(task.priority) ? 1 : 0;
  if (rule.metric === 'category') {
    const category = normalized(task.category);
    return (rule.categories || []).some((item) => normalized(item) === category) ? 1 : 0;
  }
  if (rule.metric === 'keywords') {
    const text = taskText(task);
    return (rule.keywords || []).some((keyword) => text.includes(normalized(keyword))) ? 1 : 0;
  }
  return 0;
}

async function adjustProgress(repository, challenge, amount) {
  const current = Math.max(0, Number(challenge.progress || 0));
  const goal = Math.max(0, Number(challenge.goal || 0));
  const target = Math.max(0, goal ? Math.min(goal, current + amount) : current + amount);
  const applied = target - current;
  if (!applied) return { record: challenge, applied: 0 };
  const achieved = goal > 0 && target >= goal;
  const status = achieved ? 'achieved' : challenge.status === 'achieved' ? 'active' : challenge.status;
  const record = await repository.update(challenge.id, { progress: target, status }, 'automatische-uitdaging');
  return { record, applied };
}

export async function applyAutomaticTaskChallenges({
  repository,
  task,
  pointValue = null,
  excludeRewardId = ''
}) {
  if (!repository) return [];
  const challenges = await repository.getAll();
  const awards = [];
  for (const challenge of challenges) {
    if (challenge.id === excludeRewardId || challenge.status !== 'active' || !challenge.autoRule) continue;
    const amount = automaticChallengeAmount(challenge, task, pointValue);
    if (!amount) continue;
    const result = await adjustProgress(repository, challenge, amount);
    if (result.applied) awards.push({
      rewardId: challenge.id,
      amount: result.applied,
      periodKey: challenge.periodKey || '',
      title: challenge.title
    });
  }
  return awards;
}

export async function rollbackAutomaticTaskChallenges(repository, awards = []) {
  if (!repository || !awards.length) return 0;
  let rolledBack = 0;
  for (const award of awards) {
    const challenge = await repository.getById(award.rewardId);
    if (!challenge || (award.periodKey && challenge.periodKey !== award.periodKey)) continue;
    const result = await adjustProgress(repository, challenge, -Math.abs(Number(award.amount || 0)));
    if (result.applied) rolledBack += 1;
  }
  return rolledBack;
}
