import { appState, repositories } from '../state.js';
import { openAssistantForm } from './assistant-view.js';
import { routineAppliesToday, routineProgress, toggleRoutineItem } from '../services/routine-service.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { showToast } from '../components/toast.js';
import { calculateRoutinePoints } from '../services/points-service.js';

async function renderRoutines() {
  const selectedId = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  let routines = await repositories.modules.routine.getAll();
  if (selectedId) routines = routines.filter((item) => item.id === selectedId);
  else routines = routines.filter((item) => routineAppliesToday(item));
  return routines;
}

function routineCard(routine) {
  const progress = routineProgress(routine);
  const member = appState.settings.members.find((item) => item.id === routine.memberId);
  const pointValue = Number(routine.pointValue || calculateRoutinePoints(routine).points);
  return `<article class="card routine-runner"><div class="card-header"><div><h2>${e(routine.title)}</h2><p class="small muted">${e(member?.name || 'Hele gezin')} · ${e(routine.startTime || 'Geen vaste tijd')}</p></div><strong>${progress.percentage}% · ${pointValue} pt</strong></div><div class="progress"><span style="width:${progress.percentage}%"></span></div><ul class="item-list">${(routine.items || []).map((item) => `<li class="list-item"><label class="check-row grow"><input type="checkbox" data-routine-item="${e(item.id)}" data-routine-id="${e(routine.id)}" ${progress.completedIds.includes(item.id) ? 'checked' : ''}><span><strong>${e(item.text)}</strong>${item.note ? `<small>${e(item.note)}</small>` : ''}</span></label></li>`).join('')}</ul><div class="page-actions"><button class="button secondary small" data-edit-routine="${e(routine.id)}">Routine aanpassen</button><button class="button ghost small" data-copy-routine="${e(routine.id)}">Kopiëren</button></div></article>`;
}

export const routinesView = {
  async render() {
    const routines = await renderRoutines();
    return `<section class="page-stack routines-page"><div class="page-header"><div><p class="eyebrow">Vandaag</p><h2>Routines</h2><p class="muted">Iedere dag een frisse checklist; voltooide dagen blijven in de geschiedenis.</p></div><button class="button" data-new-routine>＋ Routine</button></div><div id="routine-runners">${routines.length ? `<div class="content-grid two">${routines.map(routineCard).join('')}</div>` : emptyState('Geen routine voor vandaag', 'Maak een routine of controleer de ingestelde weekdagen.', '<button class="button" data-new-routine>Routine maken</button>')}</div></section>`;
  },
  async mount(root) {
    const rerender = async () => { root.innerHTML = await routinesView.render(); };
    root.addEventListener('click', async (event) => {
      try {
        const add = event.target.closest('[data-new-routine]'); if (add) return openAssistantForm('routine', null, rerender);
        const edit = event.target.closest('[data-edit-routine]'); if (edit) { const routine = await repositories.modules.routine.getById(edit.dataset.editRoutine); return openAssistantForm('routine', routine, rerender); }
        const copy = event.target.closest('[data-copy-routine]'); if (copy) { const routine = await repositories.modules.routine.getById(copy.dataset.copyRoutine); const clone = { ...routine, title: `${routine.title} (kopie)`, dailyProgress: {}, completionHistory: [] }; ['id','createdAt','updatedAt','deletedAt','version','syncStatus','deviceId','createdBy','updatedBy'].forEach((key) => delete clone[key]); await repositories.modules.routine.create(clone); showToast('Routine gekopieerd.'); return rerender(); }
      } catch (error) { handleError(error); }
    });
    root.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-routine-item]'); if (!input) return;
      try {
        const routine = await repositories.modules.routine.getById(input.dataset.routineId);
        const wasComplete = routineProgress(routine).percentage === 100;
        const updated = await toggleRoutineItem(repositories.modules.routine, routine, input.dataset.routineItem);
        if (!wasComplete && routineProgress(updated).percentage === 100) {
          const points = Number(updated.pointValue || calculateRoutinePoints(updated).points);
          showToast(`Routine afgerond: ${points} punten verdiend.`);
        }
        await rerender();
      } catch (error) { handleError(error); }
    });
  }
};
