import { repositories } from '../state.js';
import { conflictFields, findConflicts, resolveConflict } from '../services/conflict-service.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { e, emptyState, handleError } from './view-helpers.js';

function short(value) {
  const result = typeof value === 'string' ? value : JSON.stringify(value);
  return result?.length > 120 ? `${result.slice(0, 117)}…` : result || 'Leeg';
}

function openMerge(item, onSaved) {
  const fields = conflictFields(item.record.conflictData);
  openModal({ title: 'Wijzigingen veld voor veld samenvoegen', wide: true, content: `<p class="muted">Kies per afwijkend veld welke versie bewaard moet blijven.</p><div class="conflict-fields">${fields.map(({ key, local, remote }) => `<fieldset><legend>${e(key)}</legend><label><input type="radio" name="field-${e(key)}" value="local" checked><span><strong>Dit apparaat</strong>${e(short(local))}</span></label><label><input type="radio" name="field-${e(key)}" value="remote"><span><strong>Centraal</strong>${e(short(remote))}</span></label></fieldset>`).join('')}</div>`, submitLabel: 'Samenvoegen', onSubmit: async (data) => {
    const fieldChoices = Object.fromEntries(fields.map(({ key }) => [key, String(data.get(`field-${key}`) || 'remote')]));
    await resolveConflict({ ...item, choice: 'merge', fieldChoices }); showToast('Conflict samengevoegd en opnieuw klaargezet voor synchronisatie.'); await onSaved();
  } });
}

export const conflictsView = {
  async render() {
    const conflicts = await findConflicts(repositories);
    return `<section class="page-stack conflicts-page"><div class="page-header"><div><p class="eyebrow">Synchronisatie</p><h2>Conflicten oplossen</h2><p class="muted">Beide versies blijven bewaard tot je bewust kiest.</p></div><span class="badge ${conflicts.length ? 'high' : 'low'}">${conflicts.length} conflict${conflicts.length === 1 ? '' : 'en'}</span></div>${conflicts.length ? `<div class="content-grid two">${conflicts.map((item, index) => `<article class="card"><span class="badge">${e(item.entity)}</span><h2>${e(item.record.title || item.record.name || item.record.productName || item.record.id)}</h2><p>${conflictFields(item.record.conflictData).length} afwijkende velden</p><div class="page-actions"><button class="button small" data-conflict-local="${index}">Dit apparaat behouden</button><button class="button secondary small" data-conflict-remote="${index}">Centrale versie behouden</button><button class="button ghost small" data-conflict-merge="${index}">Samenvoegen</button></div></article>`).join('')}</div>` : emptyState('Geen conflicten', 'Alle lokale en centrale gegevens zijn zonder handmatige keuze verwerkt.')}</section>`;
  },
  async mount(root) {
    const rerender = async () => { root.innerHTML = await conflictsView.render(); };
    root.addEventListener('click', async (event) => {
      try {
        const conflicts = await findConflicts(repositories);
        const local = event.target.closest('[data-conflict-local]'); if (local) { await resolveConflict({ ...conflicts[Number(local.dataset.conflictLocal)], choice: 'local' }); showToast('Lokale versie gekozen.'); return rerender(); }
        const remote = event.target.closest('[data-conflict-remote]'); if (remote) { await resolveConflict({ ...conflicts[Number(remote.dataset.conflictRemote)], choice: 'remote' }); showToast('Centrale versie gekozen.'); return rerender(); }
        const merge = event.target.closest('[data-conflict-merge]'); if (merge) return openMerge(conflicts[Number(merge.dataset.conflictMerge)], rerender);
      } catch (error) { handleError(error); }
    });
  }
};
