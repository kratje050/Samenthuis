import { repositories, appState } from '../state.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { nextTaskDate } from '../services/recurrence-service.js';
import { addDays, toDateKey } from '../utils/dates.js';
import { bindAction, consumeHashAction, e, emptyState, field, handleError, numberValue, textArea, value } from './view-helpers.js';
import { accountDisplayName } from '../utils/account.js';
import { icon } from '../utils/icons.js';
import { addRewardProgress } from '../services/household-assistant-service.js';
import { calculateTaskPoints } from '../services/points-service.js';
import { applyAutomaticTaskChallenges, rollbackAutomaticTaskChallenges } from '../services/challenge-progress-service.js';

let taskFilters = { scope: 'all', status: 'open' };

function currentMemberId() {
  const name = accountDisplayName(appState.cloud).toLocaleLowerCase('nl-NL');
  return name ? appState.settings.members.find((member) => member.name.toLocaleLowerCase('nl-NL') === name)?.id || '' : '';
}

function taskForm(record = {}, rewards = []) {
  const members = appState.settings.members;
  const calculation = calculateTaskPoints(record);
  const challengeField = rewards.length ? field('rewardId', 'Ook meetellen voor uitdaging', { rewardId: record.rewardId || '' }, { options: [{ value: '', label: 'Geen extra uitdaging' }, ...rewards.map((reward) => ({ value: reward.id, label: reward.title }))] }) : '';
  const pointFields = appState.settings.rewardsEnabled !== false ? `${field('estimatedMinutes', 'Geschatte tijd in minuten', { estimatedMinutes: record.estimatedMinutes || '' }, { type: 'number', min: '1', placeholder: 'Optioneel' })}
    ${challengeField}<div class="field full automatic-points-card" role="status" aria-live="polite"><span>Automatisch berekende punten</span><output id="task-points-preview">${calculation.points} punten</output><small id="task-points-reason">${e(calculation.reasons.join(' · '))}. De app berekent dit opnieuw wanneer de taak verandert.</small><input type="hidden" name="rewardPoints" value="${calculation.points}"></div>` : '';
  return `<div class="form-grid">${field('title', 'Titel', record, { required: true, className: 'full' })}${textArea('description', 'Omschrijving', record, 'full')}
    ${field('assignedTo', 'Toegewezen aan', { assignedTo: record.assignedTo || currentMemberId() }, { options: [{ value: '', label: 'Hele gezin' }, ...members.map((member) => ({ value: member.id, label: member.name }))] })}
    ${field('priority', 'Prioriteit', { priority: record.priority || 'normal' }, { options: [{ value: 'low', label: 'Laag' }, { value: 'normal', label: 'Normaal' }, { value: 'high', label: 'Hoog' }, { value: 'urgent', label: 'Dringend' }] })}
    ${field('date', 'Einddatum', { date: record.date || toDateKey() }, { type: 'date' })}${field('time', 'Tijd', record, { type: 'time' })}
    ${field('category', 'Categorie', { category: record.category || 'Huishouden' }, { options: ['Huishouden', 'Kinderen', 'Tuin', 'Administratie', 'Huisdieren', 'Overig'] })}
    ${field('recurrence', 'Herhaling', { recurrence: record.recurrence || 'none' }, { options: [{ value: 'none', label: 'Niet herhalen' }, { value: 'daily', label: 'Dagelijks' }, { value: 'weekly', label: 'Wekelijks' }, { value: 'monthly', label: 'Maandelijks' }, { value: 'custom', label: 'Eigen interval' }] })}
    ${field('recurrenceInterval', 'Iedere', { recurrenceInterval: record.recurrenceInterval || 1 }, { type: 'number', min: '1' })}${field('recurrenceUnit', 'Intervaleenheid', { recurrenceUnit: record.recurrenceUnit || 'days' }, { options: [{ value: 'days', label: 'dag(en)' }, { value: 'weeks', label: 'week/weken' }, { value: 'months', label: 'maand(en)' }] })}
    ${pointFields}${textArea('note', 'Notitie', record, 'full')}</div>`;
}

async function openTask(record = null) {
  const editing = Boolean(record);
  const rewards = (await repositories.modules.reward.getAll()).filter((item) => item.status === 'active');
  const modal = openModal({
    title: editing ? 'Taak aanpassen' : 'Nieuwe taak', content: taskForm(record || {}, rewards), submitLabel: editing ? 'Opslaan' : 'Taak toevoegen',
    onSubmit: async (data) => {
      const task = {
        title: value(data, 'title'), description: value(data, 'description'), assignedTo: value(data, 'assignedTo') || null,
        priority: value(data, 'priority'), date: value(data, 'date'), time: value(data, 'time'), category: value(data, 'category'),
        recurrence: value(data, 'recurrence'), recurrenceInterval: numberValue(data, 'recurrenceInterval', 1), recurrenceUnit: value(data, 'recurrenceUnit'),
        status: editing ? record.status : 'open', note: value(data, 'note'), parentTaskId: editing ? record.parentTaskId || null : null,
        estimatedMinutes: numberValue(data, 'estimatedMinutes', 0),
        rewardId: value(data, 'rewardId'), rewardAwarded: editing ? Boolean(record.rewardAwarded) : false
      };
      if (!task.title) throw new Error('Vul een titel in.');
      task.rewardPoints = calculateTaskPoints(task).points;
      if (editing) await repositories.tasks.update(record.id, task); else await repositories.tasks.create(task);
      showToast(`${editing ? 'Taak aangepast' : 'Taak toegevoegd'} met automatisch ${task.rewardPoints} punten.`); await refreshTasks();
    }
  });
  const form = modal.querySelector('form');
  const refreshPointPreview = () => {
    const data = new FormData(form);
    const calculation = calculateTaskPoints({
      title: value(data, 'title'), description: value(data, 'description'), note: value(data, 'note'),
      category: value(data, 'category'), priority: value(data, 'priority'),
      estimatedMinutes: numberValue(data, 'estimatedMinutes', 0)
    });
    const output = form.querySelector('#task-points-preview');
    const reason = form.querySelector('#task-points-reason');
    const hidden = form.querySelector('[name="rewardPoints"]');
    if (output) output.textContent = `${calculation.points} punten`;
    if (reason) reason.textContent = `${calculation.reasons.join(' · ')}. De app berekent dit opnieuw wanneer de taak verandert.`;
    if (hidden) hidden.value = String(calculation.points);
  };
  form.addEventListener('input', refreshPointPreview);
  form.addEventListener('change', refreshPointPreview);
  refreshPointPreview();
}

async function completeTask(item) {
  if (item.status === 'done') {
    if (item.rewardAwarded && item.rewardId && Number(item.rewardPoints || 0) > 0) {
      const reward = await repositories.modules.reward.getById(item.rewardId);
      if (reward) await addRewardProgress(repositories.modules.reward, reward, -Number(item.rewardPoints), reward.approvedBy || 'heropening');
    }
    await rollbackAutomaticTaskChallenges(repositories.modules.reward, item.autoRewardAwards || []);
    await repositories.tasks.update(item.id, {
      status: item.reminderDisabled ? 'archived' : 'open',
      completedAt: null, completedBy: null, rewardAwarded: false, autoRewardAwards: []
    });
    showToast('Taak heropend; de punten en automatische uitdagingen zijn teruggedraaid.'); return;
  }
  const completedAt = new Date();
  const completedBy = item.assignedTo || currentMemberId() || null;
  const pointValue = Number(item.rewardPoints || calculateTaskPoints(item).points);
  const pointMember = appState.settings.members.find((member) => member.id === completedBy);
  const scoreMessage = appState.settings.rewardsEnabled !== false ? ` ${pointValue} punt${pointValue === 1 ? '' : 'en'}${pointMember ? ` voor ${pointMember.name}` : ' voor het gezin'}.` : '';
  let rewardAwarded = false;
  let rewardMessage = '';
  if (appState.settings.rewardsEnabled !== false && item.rewardId && Number(item.rewardPoints || 0) > 0) {
    const reward = await repositories.modules.reward.getById(item.rewardId);
    if (reward && reward.status === 'active') {
      if (reward.approvalRequired && !reward.approvedBy) rewardMessage = ' De punten wachten totdat bij de beloning een volwassene is gekozen.';
      else { await addRewardProgress(repositories.modules.reward, reward, pointValue, reward.approvedBy); rewardAwarded = true; rewardMessage = ` Ook ${pointValue} voortgang voor “${reward.title}”.`; }
    }
  }
  const autoRewardAwards = appState.settings.rewardsEnabled !== false
    ? await applyAutomaticTaskChallenges({
      repository: repositories.modules.reward,
      task: { ...item, completedAt: completedAt.toISOString(), completedBy },
      pointValue,
      excludeRewardId: item.rewardId
    })
    : [];
  await repositories.tasks.update(item.id, {
    status: 'done', completedAt: completedAt.toISOString(), completedBy, rewardAwarded, autoRewardAwards
  });
  const automaticMessage = autoRewardAwards.length ? ` ${autoRewardAwards.length} automatische uitdaging${autoRewardAwards.length === 1 ? '' : 'en'} bijgewerkt.` : '';
  const nextDate = nextTaskDate(item, completedAt);
  if (nextDate) {
    const { id, createdAt, updatedAt, deletedAt, version, deviceId, syncStatus, updatedBy, completedAt: oldCompletedAt, completedBy: oldCompletedBy, autoRewardAwards: oldAutoRewardAwards, ...copy } = item;
    await repositories.tasks.create({ ...copy, date: nextDate, status: item.reminderDisabled ? 'archived' : 'open', completedBy: null, rewardAwarded: false, autoRewardAwards: [], parentTaskId: item.parentTaskId || item.id });
    showToast(`Taak afgerond; de volgende staat op ${nextDate}.${scoreMessage}${rewardMessage}${automaticMessage}`);
  } else showToast(`Taak afgerond.${scoreMessage}${rewardMessage}${automaticMessage}`);
}

function taskRow(item) {
  const member = appState.settings.members.find((candidate) => candidate.id === item.assignedTo);
  const priority = ({ low: 'Laag', normal: 'Normaal', high: 'Hoog', urgent: 'Dringend' })[item.priority] || 'Normaal';
  return `<li class="task-row ${item.status === 'done' ? 'is-complete' : ''}">
    <button class="task-check" data-toggle-task="${item.id}" aria-label="${item.status === 'done' ? 'Heropenen' : 'Afronden'}">${item.status === 'done' ? icon('tasks') : ''}</button>
    <button class="task-row-main" type="button" data-edit-task="${item.id}"><strong>${e(item.title)}</strong><small>${member ? `<span class="tiny-avatar" style="--member-color:${member.color}">${e(String(member.icon || member.name).slice(0, 1))}</span>${e(member.name)}` : 'Gezin'}${item.time ? ` · ${e(item.time)}` : ''}${item.recurrence !== 'none' ? ' · Herhalend' : ''}</small></button>
    <span class="priority-pill ${e(item.priority)}" title="${e(item.pointsReason || 'Automatisch berekende taakpunten')}">${appState.settings.rewardsEnabled !== false ? `${e(item.rewardPoints || calculateTaskPoints(item).points)} pt · ` : ''}${e(priority)}</span>
    <details class="row-action-menu"><summary aria-label="Meer acties">${icon('more')}</summary><div><button type="button" data-edit-task="${item.id}">Aanpassen</button><button type="button" class="danger" data-delete-task="${item.id}">Verwijderen</button></div></details>
  </li>`;
}

async function refreshTasks() {
  const root = document.querySelector('#task-list');
  if (!root) return;
  const allItems = await repositories.tasks.getAll();
  const memberId = currentMemberId();
  let items = allItems.filter((item) =>
    (taskFilters.status === 'all' || (taskFilters.status === 'open' ? item.status !== 'done' : item.status === 'done')) &&
    (taskFilters.scope === 'all' || (taskFilters.scope === 'mine' ? Boolean(memberId) && item.assignedTo === memberId : taskFilters.scope === 'family' ? !item.assignedTo : ['high', 'urgent'].includes(item.priority)))
  );
  items.sort((a, b) => `${a.status === 'done'}${a.date || '9999'}${a.time || ''}`.localeCompare(`${b.status === 'done'}${b.date || '9999'}${b.time || ''}`));
  const openItems = allItems.filter((item) => item.status !== 'done');
  const openPoints = openItems.reduce((sum, item) => sum + Number(item.rewardPoints || calculateTaskPoints(item).points), 0);
  document.querySelector('#task-open-count').textContent = `${openItems.length} openstaand${appState.settings.rewardsEnabled !== false ? ` · ${openPoints} punten te verdienen` : ''}`;
  const starterItems = new Set(allItems.filter((item) => item.starterKind === 'family-task').map((item) => item.starterKey || item.id));
  const starterNote = document.querySelector('#task-starter-count');
  if (starterNote) starterNote.textContent = starterItems.size
    ? `${starterItems.size} vaste gezinstaken zijn automatisch klaargezet. Nog meer complete taaksets staan bij Sjablonen.`
    : 'Gebruik Sjablonen voor complete, herbruikbare taaksets.';
  root.closest('.tasks-page')?.querySelectorAll('[data-task-scope]').forEach((button) => button.classList.toggle('active', button.dataset.taskScope === taskFilters.scope));
  if (!items.length) {
    const message = taskFilters.scope === 'mine' && !memberId ? 'Log in en gebruik dezelfde naam als een gezinslid om jouw taken te zien.' : 'Alles is netjes bijgewerkt.';
    root.innerHTML = emptyState('Geen taken hier', message, '<button class="button" data-add-task>Taak toevoegen</button>'); return;
  }
  const today = toDateKey();
  const weekEnd = toDateKey(addDays(new Date(), 7));
  const groups = [
    ['Vandaag', items.filter((item) => item.date && item.date <= today)],
    ['Deze week', items.filter((item) => item.date && item.date > today && item.date <= weekEnd)],
    ['Later', items.filter((item) => !item.date || item.date > weekEnd)]
  ].filter(([, entries]) => entries.length);
  root.innerHTML = groups.map(([label, entries]) => `<section class="task-group"><h2>${label}</h2><ul>${entries.map(taskRow).join('')}</ul></section>`).join('');
}

export const tasksView = {
  async render() {
    return `<section class="page-stack tasks-page">
      <div class="tasks-pills segmented"><button type="button" data-task-scope="all" class="active">Alle</button><button type="button" data-task-scope="mine">Mijn taken</button><button type="button" data-task-scope="family">Gezin</button><button type="button" data-task-scope="high">Hoog</button></div>
      <div class="page-header tasks-summary"><p class="muted" id="task-open-count">0 openstaand</p><button class="button desktop-add-task" data-add-task>${icon('plus')} Nieuwe taak</button></div>
      <div class="starter-library-note"><span id="task-starter-count">De gezinsbibliotheek wordt klaargezet…</span><a href="#templates">Taaksets bekijken</a></div>
      <details class="filter-panel"><summary>Toon openstaande of afgeronde taken</summary><div class="toolbar">${field('task-status', 'Status', { 'task-status': taskFilters.status }, { options: [{ value: 'open', label: 'Openstaand' }, { value: 'done', label: 'Afgerond' }, { value: 'all', label: 'Alles' }] })}</div></details>
      <div id="task-list"></div>
    </section>`;
  },

  async mount(root) {
    bindAction(root, '[data-add-task]', () => openTask());
    root.querySelectorAll('[data-task-scope]').forEach((button) => button.addEventListener('click', async () => { taskFilters.scope = button.dataset.taskScope; await refreshTasks(); }));
    root.querySelector('[name="task-status"]').addEventListener('change', async (event) => { taskFilters.status = event.target.value; await refreshTasks(); });
    bindAction(root, '[data-toggle-task]', async (button) => { const item = await repositories.tasks.getById(button.dataset.toggleTask); await completeTask(item); await refreshTasks(); });
    bindAction(root, '[data-edit-task]', async (button) => { const item = await repositories.tasks.getById(button.dataset.editTask); if (item) openTask(item); });
    bindAction(root, '[data-delete-task]', async (button) => { const item = await repositories.tasks.getById(button.dataset.deleteTask); if (item && await confirmDialog({ message: `“${e(item.title)}” wordt verwijderd.` })) { await repositories.tasks.softDelete(item.id); showToast('Taak verwijderd.'); await refreshTasks(); } });
    await refreshTasks().catch(handleError);
    if (consumeHashAction('1')) openTask();
  }
};
