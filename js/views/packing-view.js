import { appState, repositories } from '../state.js';
import { openAssistantForm } from './assistant-view.js';
import { PACKING_PRESETS, packingProgress, presetPackingItems } from '../services/packing-service.js';
import { toggleComplexItem } from '../services/assistant-service.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { showToast } from '../components/toast.js';

let missingOnly = false;

function listCard(list, appointment) {
  const progress = packingProgress(list);
  const items = missingOnly ? progress.missing : (list.items || []);
  return `<article class="card packing-runner"><div class="card-header"><div><span class="badge">${e(list.packingType || 'Eigen lijst')}</span><h2>${e(list.title)}</h2><p class="small muted">${e(appointment ? `Bij ${appointment.title}` : list.date || 'Geen datum')}</p></div><strong>${progress.percentage}%</strong></div><div class="progress"><span style="width:${progress.percentage}%"></span></div><ul class="item-list">${items.map((item) => `<li class="list-item"><label class="check-row grow"><input type="checkbox" data-packing-item="${e(item.id)}" data-packing-id="${e(list.id)}" ${item.done ? 'checked' : ''}><span><strong>${e(item.text)}</strong><small>${e([item.quantity ? `${item.quantity}×` : '', appState.settings.members.find((member) => member.id === item.memberId)?.name, item.category, item.essential ? 'Essentieel' : ''].filter(Boolean).join(' · '))}</small></span></label></li>`).join('')}</ul><div class="page-actions"><button class="button secondary small" data-edit-packing="${e(list.id)}">Aanpassen</button><button class="button ghost small" data-copy-packing="${e(list.id)}">Lijst kopiëren</button><button class="button ghost small" data-template-packing="${e(list.id)}">Als sjabloon bewaren</button></div></article>`;
}

export const packingView = {
  async render() {
    const selectedId = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
    let lists = await repositories.modules.packing.getAll();
    if (selectedId) lists = lists.filter((item) => item.id === selectedId);
    const appointments = await repositories.appointments.getAll();
    return `<section class="page-stack packing-page"><div class="page-header"><div><p class="eyebrow">Plannen</p><h2>Paklijsten</h2><p class="muted">Zie wat nog ontbreekt en wie waarvoor verantwoordelijk is.</p></div><button class="button" data-new-packing>＋ Eigen lijst</button></div><div class="toolbar"><label class="check-row"><input id="packing-missing-only" type="checkbox" ${missingOnly ? 'checked' : ''}> Alleen ontbrekende items</label></div><div class="preset-strip">${Object.keys(PACKING_PRESETS).map((type) => `<button class="filter-chip" data-packing-preset="${e(type)}">${e(type)}</button>`).join('')}</div><div id="packing-lists">${lists.length ? `<div class="content-grid two">${lists.map((list) => listCard(list, appointments.find((item) => item.id === list.appointmentId))).join('')}</div>` : emptyState('Nog geen paklijsten', 'Kies een voorbeeld of maak een eigen lijst.')}</div></section>`;
  },
  async mount(root) {
    const rerender = async () => { root.innerHTML = await packingView.render(); };
    root.addEventListener('click', async (event) => {
      try {
        if (event.target.closest('[data-new-packing]')) return openAssistantForm('packing', null, rerender);
        const preset = event.target.closest('[data-packing-preset]');
        if (preset) { const type = preset.dataset.packingPreset; await repositories.modules.packing.create({ title: type, packingType: type, date: '', appointmentId: '', categories: ['Algemeen'], items: presetPackingItems(type), notes: '', essentialOnly: false, status: 'active' }); showToast('Paklijst aangemaakt.'); return rerender(); }
        const edit = event.target.closest('[data-edit-packing]'); if (edit) { const list = await repositories.modules.packing.getById(edit.dataset.editPacking); return openAssistantForm('packing', list, rerender); }
        const copy = event.target.closest('[data-copy-packing]'); if (copy) { const list = await repositories.modules.packing.getById(copy.dataset.copyPacking); const clone = { ...list, title: `${list.title} (kopie)`, items: (list.items || []).map((item) => ({ ...item, done: false })) }; ['id','createdAt','updatedAt','deletedAt','version','syncStatus','deviceId','createdBy','updatedBy'].forEach((key) => delete clone[key]); await repositories.modules.packing.create(clone); showToast('Paklijst gekopieerd.'); return rerender(); }
        const template = event.target.closest('[data-template-packing]'); if (template) { const list = await repositories.modules.packing.getById(template.dataset.templatePacking); await repositories.templates.create({ title: list.title, templateType: 'packing', items: (list.items || []).map((item) => ({ name: item.text })), notes: list.notes || '' }); showToast('Paklijst als herbruikbaar sjabloon bewaard.'); }
      } catch (error) { handleError(error); }
    });
    root.addEventListener('change', async (event) => {
      try {
        if (event.target.id === 'packing-missing-only') { missingOnly = event.target.checked; return rerender(); }
        const input = event.target.closest('[data-packing-item]'); if (!input) return;
        const list = await repositories.modules.packing.getById(input.dataset.packingId); await toggleComplexItem(repositories.modules.packing, list, 'items', input.dataset.packingItem); await rerender();
      } catch (error) { handleError(error); }
    });
  }
};
