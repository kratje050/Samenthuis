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

let taskFilters = { scope: 'all', status: 'open' };

function currentMemberId() {
  const name = accountDisplayName(appState.cloud).toLocaleLowerCase('nl-NL');
  return name ? appState.settings.members.find((member) => member.name.toLocaleLowerCase('nl-NL') === name)?.id || '' : '';
}

function taskForm(record = {}, rewards = []) {
  const members = appState.settings.members;
  const rewardFields = appState.settings.rewardsEnabled !== false && rewards.length ? `${field('rewardId', 'Punten tellen voor', { rewardId: record.rewardId || '' }, { options: [{ value: '', label: 'Geen beloning of uitdaging' }, ...rewards.map((reward) => ({ value: reward.id, label: reward.title }))] })}${field('rewardPoints', 'Punten bij afronden', { rewardPoints: record.rewardPoints || 0 }, { type: 'number', min: '0' })}` : '';
  return `<div class="form-grid">${field('title', 'Titel', record, { required: true, className: 'full' })}${textArea('description', 'Omschrijving', record, 'full')}
    ${field('assignedTo', 'Toegewezen aan', { assignedTo: record.assignedTo || currentMemberId() }, { options: [{ value: '', label: 'Hele gezin' }, ...members.map((member) => ({ value: member.id, label: member.name }))] })}
    ${field('priority', 'Prioriteit', { priority: record.priority || 'normal' }, { options: [{ value: 'low', label: 'Laag' }, { value: 'normal', label: 'Normaal' }, { value: 'high', label: 'Hoog' }, { value: 'urgent', label: 'Dringend' }] })}
    ${field('date', 'Einddatum', { date: record.date || toDateKey() }, { type: 'date' })}${field('time', 'Tijd', record, { type: 'time' })}
    ${field('category', 'Categorie', { category: record.category || 'Huishouden' }, { options: ['Huishouden', 'Kinderen', 'Tuin', 'Administratie', 'Huisdieren', 'Overig'] })}
    ${field('recurrence', 'Herhaling', { recurrence: record.recurrence || 'none' }, { options: [{ value: 'none', label: 'Niet herhalen' }, { value: 'daily', label: 'Dagelijks' }, { value: 'weekly', label: 'Wekelijks' }, { value: 'monthly', label: 'Maandelijks' }, { value: 'custom', label: 'Eigen interval' }] })}
    ${field('recurrenceInterval', 'Iedere', { recurrenceInterval: record.recurrenceInterval || 1 }, { type: 'number', min: '1' })}${field('recurrenceUnit', 'Intervaleenheid', { recurrenceUnit: record.recurrenceUnit || 'days' }, { options: [{ value: 'days', label: 'dag(en)' }, { value: 'weeks', label: 'week/weken' }, { value: 'months', label: 'maand(en)' }] })}
    ${rewardFields}${textArea('note', 'Notitie', record, 'full')}</div>`;
}

async function openTask(record = null) {
  const editing = Boolean(record);
  const rewards = (await repositories.modules.reward.getAll()).filter((item) => item.status === 'active');
  openModal({
    title: editing ? 'Taak aanpassen' : 'Nieuwe taak', content: taskForm(record || {}, rewards), submitLabel: editing ? 'Opslaan' : 'Taak toevoegen',
    onSubmit: async (data) => {
      const task = {
        title: value(data, 'title'), description: value(data, 'description'), assignedTo: value(data, 'assignedTo') || null,
        priority: value(data, 'priority'), date: value(data, 'date'), time: value(data, 'time'), category: value(data, 'category'),
        recurrence: value(data, 'recurrence'), recurrenceInterval: numberValue(data, 'recurrenceInterval', 1), recurrenceUnit: value(data, 'recurrenceUnit'),
        status: editing ? record.status : 'open', note: value(data, 'note'), parentTaskId: editing ? record.parentTaskId || null : null,
        rewardId: value(data, 'rewardId'), rewardPoints: numberValue(data, 'rewardPoints', 0), rewardAwarded: editing ? Boolean(record.rewardAwarded) : false
      };
      if (!task.title) throw new Error('Vul een titel in.');
      if (editing) await repositories.tasks.update(record.id, task); else await repositories.tasks.create(task);
      showToast(editing ? 'Taak aangepast.' : 'Taak toegevoegd.'); await refreshTasks();
    }
  });
}

async function completeTask(item) {
  if (item.status === 'done') {
    if (item.rewardAwarded && item.rewardId && Number(item.rewardPoints || 0) > 0) {
      const reward = await repositories.modules.reward.getById(item.rewardId);
      if (reward) await addRewardProgress(repositories.modules.reward, reward, -Number(item.rewardPoints), reward.approvedBy || 'heropening');
    }
    await repositories.tasks.update(item.id, { status: 'open', completedAt: null, rewardAwarded: false }); showToast('Taak heropend; eventuele taakpunten zijn teruggedraaid.'); return;
  }
  const completedAt = new Date();
  let rewardAwarded = false;
  let rewardMessage = '';
  if (appState.settings.rewardsEnabled !== false && item.rewardId && Number(item.rewardPoints || 0) > 0) {
    const reward = await repositories.modules.reward.getById(item.rewardId);
    if (reward && reward.status === 'active') {
      if (reward.approvalRequired && !reward.approvedBy) rewardMessage = ' De punten wachten totdat bij de beloning een volwassene is gekozen.';
      else { await addRewardProgress(repositories.modules.reward, reward, Number(item.rewardPoints), reward.approvedBy); rewardAwarded = true; rewardMessage = ` ${item.rewardPoints} punt${Number(item.rewardPoints) === 1 ? '' : 'en'} toegekend.`; }
    }
  }
  await repositories.tasks.update(item.id, { status: 'done', completedAt: completedAt.toISOString(), rewardAwarded });
  const nextDate = nextTaskDate(item, completedAt);
  if (nextDate) {
    const { id, createdAt, updatedAt, deletedAt, version, deviceId, syncStatus, updatedBy, completedAt: oldCompletedAt, ...copy } = item;
    await repositories.tasks.create({ ...copy, date: nextDate, status: 'open', rewardAwarded: false, parentTaskId: item.parentTaskId || item.id });
    showToast(`Taak afgerond; de volgende staat op ${nextDate}.${rewardMessage}`);
  } else showToast(`Taak afgerond.${rewardMessage}`);
}

function taskRow(item) {
  const member = appState.settings.members.find((candidate) => candidate.id === item.assignedTo);
  const priority = ({ low: 'Laag', normal: 'Normaal', high: 'Hoog', urgent: 'Dringend' })[item.priority] || 'Normaal';
  return `<li class="task-row ${item.status === 'done' ? 'is-complete' : ''}">
    <button class="task-check" data-toggle-task="${item.id}" aria-label="${item.status === 'done' ? 'Heropenen' : 'Afronden'}">${item.status === 'done' ? icon('tasks') : ''}</button>
    <button class="task-row-main" type="button" data-edit-task="${item.id}"><strong>${e(item.title)}</strong><small>${member ? `<span class="tiny-avatar" style="--member-color:${member.color}">${e(String(member.icon || member.name).slice(0, 1))}</span>${e(member.name)}` : 'Gezin'}${item.time ? ` · ${e(item.time)}` : ''}${item.recurrence !== 'none' ? ' · Herhalend' : ''}</small></button>
    <span class="priority-pill ${e(item.priority)}">${item.rewardId && item.rewardPoints ? `${e(item.rewardPoints)} pt · ` : ''}${e(priority)}</span>
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
  document.querySelector('#task-open-count').textContent = `${allItems.filter((item) => item.status !== 'done').length} openstaand`;
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
