import { appState, repositories, services } from '../state.js';
import { getAssistantModule } from '../modules/assistant-modules.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { icon } from '../utils/icons.js';
import { uuid } from '../utils/uuid.js';
import { formatCurrency } from '../utils/formatting.js';
import { convertAssistantRecord } from '../services/conversion-service.js';
import { addSavingsTransaction, filterAssistantRecords, isOverdue, recordTitle, serializeAssistantForm, validateAssistantRecord } from '../services/assistant-service.js';
import { priceHistoryStats, subscriptionSummary } from '../services/finance-tools-service.js';
import { addRewardProgress, completeMaintenance, completeWaste } from '../services/household-assistant-service.js';
import { bindAction, e, emptyState, handleError } from './view-helpers.js';

const conversionLabels = { appointment: 'Afspraak', task: 'Taak', shopping: 'Boodschap', outing: 'Uitje', notice: 'Prikbord', gift: 'Cadeau', recipe: 'Recept', child_note: 'Notitie kindprofiel' };
const weekdayLabels = [['1','Ma'],['2','Di'],['3','Wo'],['4','Do'],['5','Vr'],['6','Za'],['0','Zo']];

function activeModule() {
  const query = new URLSearchParams(location.hash.split('?')[1] || '');
  const module = query.get('module') || 'notice';
  return { module, definition: getAssistantModule(module), query };
}

function optionHtml(option, current) {
  const item = typeof option === 'string' ? { value: option, label: option } : option;
  return `<option value="${e(item.value)}" ${String(item.value) === String(current) ? 'selected' : ''}>${e(item.label)}</option>`;
}

function memberOptions(current = '', includeBlank = true) {
  const options = (appState.settings?.members || []).map((member) => `<option value="${e(member.id)}" ${member.id === current ? 'selected' : ''}>${e(member.name)}</option>`).join('');
  return `${includeBlank ? '<option value="">Hele gezin / niet toegewezen</option>' : ''}${options}`;
}

function checkboxGroup(name, choices, selected = []) {
  return choices.map(({ value, label, color }) => `<label class="choice-check"><input type="checkbox" name="${e(name)}" value="${e(value)}" ${selected.includes(value) ? 'checked' : ''}><span ${color ? `style="--member-color:${e(color)}"` : ''}>${e(label)}</span></label>`).join('');
}

function complexRow(type, item = {}) {
  const id = item.id || uuid();
  if (type === 'checklist') return `<div class="complex-row checklist-editor-row" data-complex-row data-row-id="${e(id)}" draggable="true">
    <input data-key="done" type="checkbox" ${item.done ? 'checked' : ''} aria-label="Afgevinkt">
    <input data-key="text" value="${e(item.text || '')}" placeholder="Item" required>
    <input data-key="quantity" type="number" min="0" step="1" value="${e(item.quantity || 1)}" aria-label="Aantal">
    <select data-key="memberId" aria-label="Verantwoordelijke">${memberOptions(item.memberId)}</select>
    <input data-key="category" value="${e(item.category || '')}" placeholder="Categorie" aria-label="Categorie">
    <label class="essential-check"><input data-key="essential" type="checkbox" ${item.essential ? 'checked' : ''}> Essentieel</label>
    <input data-key="note" value="${e(item.note || '')}" placeholder="Notitie" aria-label="Notitie">
    <button class="mini-action" type="button" data-move-complex="up" aria-label="Regel omhoog">↑</button>
    <button class="mini-action" type="button" data-move-complex="down" aria-label="Regel omlaag">↓</button>
    <button class="mini-action danger" type="button" data-remove-complex aria-label="Regel verwijderen">×</button>
  </div>`;
  if (type === 'transactions') return `<div class="complex-row transaction-editor-row" data-complex-row data-row-id="${e(id)}"><input data-key="date" type="date" value="${e(item.date || '')}" aria-label="Datum"><input data-key="amount" type="number" step="0.01" value="${e(item.amount || '')}" placeholder="Bedrag" aria-label="Bedrag"><input data-key="note" value="${e(item.note || '')}" placeholder="Omschrijving" aria-label="Omschrijving"><button class="mini-action danger" type="button" data-remove-complex aria-label="Regel verwijderen">×</button></div>`;
  if (type === 'guestList') return `<div class="complex-row guest-editor-row" data-complex-row data-row-id="${e(id)}"><input data-key="name" value="${e(item.name || '')}" placeholder="Naam gast"><select data-key="guestType" aria-label="Gastsoort"><option value="adult" ${item.guestType === 'adult' ? 'selected' : ''}>Volwassene</option><option value="child" ${item.guestType === 'child' ? 'selected' : ''}>Kind</option></select><select data-key="attendance" aria-label="Aanmeldstatus"><option value="invited">Uitgenodigd</option><option value="accepted" ${item.attendance === 'accepted' ? 'selected' : ''}>Komt</option><option value="declined" ${item.attendance === 'declined' ? 'selected' : ''}>Komt niet</option><option value="maybe" ${item.attendance === 'maybe' ? 'selected' : ''}>Misschien</option></select><button class="mini-action danger" type="button" data-remove-complex aria-label="Regel verwijderen">×</button></div>`;
  return `<div class="complex-row choice-editor-row" data-complex-row data-row-id="${e(id)}"><input data-key="text" value="${e(item.text || '')}" placeholder="Keuze"><label><input data-key="excluded" type="checkbox" ${item.excluded ? 'checked' : ''}> Tijdelijk uitsluiten</label><button class="mini-action danger" type="button" data-remove-complex aria-label="Regel verwijderen">×</button></div>`;
}

function renderField(descriptor, record) {
  const value = record[descriptor.name] ?? descriptor.default ?? '';
  const classes = `field ${descriptor.wide ? 'full' : ''}`;
  const required = descriptor.required ? 'required' : '';
  const requiredLabel = descriptor.required ? ' *' : '';
  if (descriptor.type === 'checkbox') return `<label class="check-row ${descriptor.wide ? 'full' : ''}"><input name="${e(descriptor.name)}" type="checkbox" ${value ? 'checked' : ''}> ${e(descriptor.label)}</label>`;
  if (descriptor.type === 'textarea' || descriptor.type === 'lines') return `<div class="${classes}"><label for="assistant-${e(descriptor.name)}">${e(descriptor.label)}${requiredLabel}</label><textarea id="assistant-${e(descriptor.name)}" name="${e(descriptor.name)}" rows="${descriptor.type === 'lines' ? 5 : 4}" ${required}>${e(Array.isArray(value) ? value.join('\n') : value)}</textarea>${descriptor.type === 'lines' ? '<small>Eén regel per item.</small>' : ''}</div>`;
  if (descriptor.type === 'select') return `<div class="${classes}"><label for="assistant-${e(descriptor.name)}">${e(descriptor.label)}${requiredLabel}</label><select id="assistant-${e(descriptor.name)}" name="${e(descriptor.name)}" ${required}>${(descriptor.options || []).map((option) => optionHtml(option, value)).join('')}</select></div>`;
  if (descriptor.type === 'member') return `<div class="${classes}"><label for="assistant-${e(descriptor.name)}">${e(descriptor.label)}${requiredLabel}</label><select id="assistant-${e(descriptor.name)}" name="${e(descriptor.name)}" ${required}>${memberOptions(value, !descriptor.required)}</select></div>`;
  if (descriptor.type === 'members') return `<fieldset class="field full choice-field"><legend>${e(descriptor.label)}${requiredLabel}</legend>${checkboxGroup(descriptor.name, (appState.settings?.members || []).map((member) => ({ value: member.id, label: member.name, color: member.color })), value || [])}</fieldset>`;
  if (descriptor.type === 'cloudMembers') return `<fieldset class="field full choice-field"><legend>${e(descriptor.label)}</legend>${(appState.cloud.familyMembers || []).length ? checkboxGroup(descriptor.name, appState.cloud.familyMembers.map((member) => ({ value: member.user_id, label: member.display_name })), value || []) : '<p class="small muted">Koppel een online gezin om cadeaus servermatig voor accounts te verbergen.</p>'}</fieldset>`;
  if (descriptor.type === 'weekdays') return `<fieldset class="field full choice-field"><legend>${e(descriptor.label)}${requiredLabel}</legend>${checkboxGroup(descriptor.name, weekdayLabels.map(([day,label]) => ({ value: day, label })), value || [])}</fieldset>`;
  if (['checklist', 'transactions', 'guestList', 'choices'].includes(descriptor.type)) {
    const items = Array.isArray(value) ? value : [];
    return `<fieldset class="field full complex-field" data-complex-field="${e(descriptor.name)}" data-complex-type="${e(descriptor.type)}"><legend>${e(descriptor.label)}${requiredLabel}</legend><div data-complex-rows>${items.map((item) => complexRow(descriptor.type, item)).join('')}</div><button class="button secondary small" type="button" data-add-complex>＋ Regel toevoegen</button></fieldset>`;
  }
  if (['image', 'file'].includes(descriptor.type)) return `<div class="${classes}"><label for="assistant-${e(descriptor.name)}">${e(descriptor.label)}</label>${value ? `<p class="small badge low">Bestand opgeslagen</p><div class="file-preview" data-file-preview="${e(value)}"></div>` : ''}<input id="assistant-${e(descriptor.name)}" name="${e(descriptor.name)}" type="file" accept="${descriptor.type === 'image' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf,text/plain'}"></div>`;
  const inputType = descriptor.type === 'pin' ? 'password' : descriptor.type || 'text';
  return `<div class="${classes}"><label for="assistant-${e(descriptor.name)}">${e(descriptor.label)}${requiredLabel}</label><input id="assistant-${e(descriptor.name)}" name="${e(descriptor.name)}" type="${e(inputType)}" value="${descriptor.type === 'pin' ? '' : e(value)}" ${required} ${descriptor.min !== undefined ? `min="${e(descriptor.min)}"` : ''} ${descriptor.step !== undefined ? `step="${e(descriptor.step)}"` : ''} ${descriptor.readonly ? 'readonly' : ''} ${descriptor.type === 'pin' ? 'inputmode="numeric" pattern="[0-9]{4,8}" placeholder="4 tot 8 cijfers"' : ''}></div>`;
}

function formHtml(definition, record) {
  return `${definition.privacy ? '<div class="privacy-warning" role="note"><strong>Privé-informatie</strong><span>Controleer zorgvuldig wie toegang heeft. Medische gegevens worden alleen door het gezin ingevoerd en niet door Samen Thuis geïnterpreteerd.</span></div>' : ''}<div class="form-grid assistant-form-grid">${definition.fields.map((descriptor) => renderField(descriptor, record)).join('')}</div>`;
}

async function hydrateFilePreviews(modal) {
  const previews = [...modal.querySelectorAll('[data-file-preview]')];
  for (const preview of previews) {
    const metadata = await repositories.files.getById(preview.dataset.filePreview);
    if (!metadata) continue;
    const url = await services.files.objectUrl(metadata.id).catch(() => null);
    if (metadata.mimeType?.startsWith('image/')) {
      if (url) preview.innerHTML = `<a href="${e(url)}" target="_blank" rel="noopener"><img src="${e(url)}" alt="${e(metadata.label || 'Opgeslagen afbeelding')}"></a>`;
    } else if (url) preview.innerHTML = `<a class="button secondary small" href="${e(url)}" download="${e(metadata.fileName || 'bestand')}">Bestand openen of downloaden: ${e(metadata.fileName || metadata.label || 'bestand')}</a>`;
    else preview.innerHTML = `<span>${e(metadata.fileName || metadata.label || 'Opgeslagen bestand')} · alleen beschikbaar zodra dit bestand online of lokaal aanwezig is</span>`;
  }
}

export function openAssistantForm(module, record = null, onSaved = refreshAssistant) {
  const definition = getAssistantModule(module);
  if (!definition) return;
  const recordId = record?.id || uuid();
  const modal = openModal({
    title: record ? `${definition.singular} aanpassen` : `Nieuw ${definition.singular}`,
    content: formHtml(definition, record || {}), wide: true,
    onSubmit: async (formData, form) => {
      const data = await serializeAssistantForm({ definition, module, formData, form, existing: record || {}, fileService: services.files, recordId });
      validateAssistantRecord(definition, data);
      if (module === 'family_mode' && data.active) {
        const others = await repositories.modules.family_mode.getAll();
        for (const other of others.filter((item) => item.id !== record?.id && item.active)) await repositories.modules.family_mode.update(other.id, { active: false });
      }
      if (record) await repositories.modules[module].update(record.id, data);
      else await repositories.modules[module].create({ ...data, id: recordId });
      showToast(`${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} opgeslagen.`);
      await onSaved?.();
    }
  });
  modal.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-complex]');
    if (add) {
      const fieldset = add.closest('[data-complex-field]');
      fieldset.querySelector('[data-complex-rows]').insertAdjacentHTML('beforeend', complexRow(fieldset.dataset.complexType));
      fieldset.querySelector('[data-complex-row]:last-child input, [data-complex-row]:last-child select')?.focus();
    }
    const remove = event.target.closest('[data-remove-complex]');
    if (remove) remove.closest('[data-complex-row]').remove();
    const move = event.target.closest('[data-move-complex]');
    if (move) {
      const row = move.closest('[data-complex-row]');
      if (move.dataset.moveComplex === 'up' && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
      if (move.dataset.moveComplex === 'down' && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
      row.querySelector('[data-key="text"]')?.focus();
    }
  });
  let draggedRow = null;
  modal.addEventListener('dragstart', (event) => { draggedRow = event.target.closest('[data-complex-row]'); event.dataTransfer?.setData('text/plain', draggedRow?.dataset.rowId || ''); });
  modal.addEventListener('dragover', (event) => { if (draggedRow && event.target.closest('[data-complex-row]')) event.preventDefault(); });
  modal.addEventListener('drop', (event) => {
    const target = event.target.closest('[data-complex-row]');
    if (!draggedRow || !target || draggedRow === target) return;
    event.preventDefault(); target.parentElement.insertBefore(draggedRow, target);
  });
  modal.addEventListener('dragend', () => { draggedRow = null; });
  hydrateFilePreviews(modal).catch(() => {});
  return modal;
}

function displayValue(field, value) {
  if (value === true) return 'Ja';
  if (value === false || value === '' || value === null || value === undefined) return '';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (field.type === 'number' && /amount|cost|price|budget/i.test(field.name)) return formatCurrency(Number(value || 0), appState.settings.currency);
  if (field.type === 'member') return appState.settings.members.find((member) => member.id === value)?.name || '';
  return String(value);
}

function specialActions(module, record) {
  const actions = [];
  if (module === 'packing') actions.push(`<a class="button small secondary" href="#packing?id=${e(record.id)}">Paklijst openen</a>`);
  if (module === 'routine') actions.push(`<a class="button small secondary" href="#routines?id=${e(record.id)}">Routine uitvoeren</a>`);
  if (module === 'babysitting') actions.push(`<a class="button small secondary" href="#babysitter?id=${e(record.id)}">Oppasmodus openen</a>`);
  if (module === 'emergency') actions.push(`<button class="button small secondary" data-print-emergency="${e(record.id)}">Afdrukken</button>`);
  if (module === 'decision_wheel') actions.push(`<a class="button small secondary" href="#decision?id=${e(record.id)}">Wiel draaien</a>`);
  if (module === 'loan' && record.status !== 'returned') actions.push(`<button class="button small secondary" data-return-loan="${e(record.id)}">Teruggebracht</button>`);
  if (module === 'inbox' && !record.processed) actions.push(`<button class="button small secondary" data-process-inbox="${e(record.id)}">Als verwerkt</button>`);
  if (module === 'family_mode' && !record.active) actions.push(`<button class="button small secondary" data-activate-mode="${e(record.id)}">Modus activeren</button>`);
  if (module === 'maintenance' && record.status !== 'archived') actions.push(`<button class="button small secondary" data-complete-maintenance="${e(record.id)}">Onderhoud uitgevoerd</button>`);
  if (module === 'appliance' && !record.maintenanceId) actions.push(`<button class="button small secondary" data-appliance-maintenance="${e(record.id)}">Onderhoudstaak maken</button>`);
  if (module === 'waste' && !record.broughtInside) actions.push(`<button class="button small secondary" data-complete-waste="${e(record.id)}">${record.putOutside ? 'Container binnen' : 'Container buiten'}</button>`);
  if (module === 'reward' && record.status === 'active' && appState.settings.rewardsEnabled !== false && !record.autoRule) actions.push(`<button class="button small secondary" data-reward-point="${e(record.id)}">＋1 voortgang</button>`);
  if (module === 'reward' && record.status === 'active' && record.autoRule) actions.push('<span class="badge low">Loopt automatisch</span>');
  if (module === 'child') actions.push(`<button class="button small secondary" data-print-profile="${e(record.id)}">Noodoverzicht printen</button><a class="button small ghost" href="#agenda?member=${e(record.memberId || '')}">Afspraken openen</a>`);
  if (module === 'family_memory') actions.push(`<button class="button small secondary" data-print-memory="${e(record.id)}">Printen</button>`);
  if (module === 'bucket_list' && !record.completed) actions.push(`<button class="button small secondary" data-complete-bucket="${e(record.id)}">Afronden</button>`);
  if (module === 'bucket_list' && record.completed) actions.push(`<button class="button small secondary" data-bucket-memory="${e(record.id)}">Fotomoment maken</button>`);
  if (module === 'savings_goal' && record.status !== 'archived') actions.push(`<button class="button small secondary" data-savings-change="${e(record.id)}">Bedrag wijzigen</button>`);
  if (module === 'storage_location') actions.push(`<button class="button small secondary" data-copy-location="${e(record.id)}">Locatie kopiëren</button>`);
  if (module === 'storage_location') actions.push(`<button class="button small ghost" data-print-location="${e(record.id)}">Label maken</button>`);
  if (module === 'notice') actions.push(`<button class="button small secondary" data-read-notice="${e(record.id)}">Gelezen</button>`);
  if (module === 'visit_plan') actions.push(`<button class="button small secondary" data-visit-shopping="${e(record.id)}">Eten naar boodschappen</button><button class="button small secondary" data-visit-tasks="${e(record.id)}">Opruimen naar taken</button>`);
  if (module === 'home_project') actions.push(`<button class="button small secondary" data-project-tasks="${e(record.id)}">Stappen naar taken</button><button class="button small secondary" data-project-shopping="${e(record.id)}">Materialen naar boodschappen</button><button class="button small secondary" data-project-expense="${e(record.id)}">Kosten boeken</button>`);
  return actions.join('');
}

function cardHtml(module, definition, record) {
  const mutedStarterRoutine = module === 'routine' && record.reminderDisabled && record.starterKind === 'family-routine' && record.status === 'archived';
  const details = definition.fields.filter((field) => !['image','file','checkbox','pin','cloudMembers'].includes(field.type)).map((field) => ({ field, value: displayValue(field, record[field.name]) })).filter((item) => item.value && item.field.name !== definition.titleField).slice(0, 4);
  if (module === 'child' && record.birthDate) {
    const born = new Date(`${record.birthDate}T12:00:00`);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate(), 12)) age -= 1;
    if (age >= 0) details.unshift({ field: { label: 'Leeftijd' }, value: `${age} jaar` });
  }
  const progress = module === 'savings_goal' ? Math.min(100, Math.round(Number(record.currentAmount || 0) / Math.max(1, Number(record.targetAmount || 1)) * 100)) : null;
  const rewardProgress = module === 'reward' ? Math.min(100, Math.round(Number(record.progress || 0) / Math.max(1, Number(record.goal || 1)) * 100)) : null;
  return `<article class="card assistant-card ${isOverdue(record) ? 'is-overdue' : ''}">
    ${module === 'inbox' ? `<label class="assistant-select"><input type="checkbox" data-inbox-select="${e(record.id)}"> Selecteer</label>` : ''}
    <div class="card-header"><div><span class="badge ${record.status === 'archived' && !mutedStarterRoutine ? '' : 'low'}">${e(mutedStarterRoutine ? 'actief · stil' : record.status || 'actief')}</span><h2>${e(recordTitle(definition, record))}</h2></div><div class="list-actions"><button class="mini-action" data-edit-assistant="${e(record.id)}" aria-label="Aanpassen">${icon('edit')}</button><button class="mini-action" data-copy-assistant="${e(record.id)}" aria-label="Kopiëren">${icon('copy')}</button><button class="mini-action danger" data-delete-assistant="${e(record.id)}" aria-label="Verwijderen">${icon('trash')}</button></div></div>
    ${details.length ? `<dl class="assistant-details">${details.map(({ field, value }) => `<div><dt>${e(field.label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>` : '<p class="muted">Geen aanvullende informatie.</p>'}
    ${progress !== null ? `<div class="progress" aria-label="${progress}% gespaard"><span style="width:${progress}%"></span></div><p class="small muted">${progress}% van het doelbedrag</p>` : ''}
    ${rewardProgress !== null ? `<div class="progress reward-progress" aria-label="${rewardProgress}% van de uitdaging"><span style="width:${rewardProgress}%"></span></div><p class="small muted"><strong>${e(record.progress || 0)} van ${e(record.goal || 0)} ${e(record.progressUnit || 'stappen')}</strong>${record.autoRule ? ' · wordt bijgewerkt zodra een passende taak wordt afgerond' : ''}</p>` : ''}
    <div class="assistant-card-actions">${specialActions(module, record)}${(definition.conversions || []).map((target) => `<button class="button small ghost" data-convert-assistant="${e(record.id)}" data-convert-target="${e(target)}">Naar ${e(conversionLabels[target])}</button>`).join('')}${mutedStarterRoutine ? '<span class="badge">Starter zonder melding</span>' : `<button class="button small ghost" data-archive-assistant="${e(record.id)}">${record.status === 'archived' ? 'Opnieuw openen' : 'Archiveren'}</button>`}</div>
  </article>`;
}

async function refreshAssistant() {
  const root = document.querySelector('#assistant-list');
  if (!root) return;
  const { module, definition } = activeModule();
  if (!definition) { root.innerHTML = emptyState('Onderdeel niet gevonden', 'Open het onderdeel opnieuw via Meer.'); return; }
  const query = document.querySelector('#assistant-search')?.value || '';
  const status = document.querySelector('#assistant-status')?.value || 'all';
  const typeControl = document.querySelector('#assistant-type');
  const memberControl = document.querySelector('#assistant-member');
  let items = filterAssistantRecords(await repositories.modules[module].getAll(), {
    query, status, module,
    typeField: typeControl?.dataset.field || '', type: typeControl?.value || 'all',
    memberField: memberControl?.dataset.field || '', memberId: memberControl?.value || 'all',
    includeExpired: Boolean(document.querySelector('#assistant-expired')?.checked)
  });
  const memoryView = document.querySelector('#assistant-memory-view')?.value || 'timeline';
  const now = new Date();
  if (module === 'family_memory' && memoryView === 'month') items = items.filter((item) => String(item.date || '').startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`));
  if (module === 'family_memory' && memoryView === 'year') items = items.filter((item) => String(item.date || '').startsWith(String(now.getFullYear())));
  if (module === 'family_memory' && memoryView === 'favorites') items = items.filter((item) => item.favorite);
  const sort = document.querySelector('#assistant-sort')?.value || 'default';
  items.sort((a, b) => {
    if (sort === 'cost-low') return Number(a.estimatedCost || 0) - Number(b.estimatedCost || 0);
    if (sort === 'cost-high') return Number(b.estimatedCost || 0) - Number(a.estimatedCost || 0);
    if (sort === 'season') return String(a.bestSeason || '').localeCompare(String(b.bestSeason || ''), 'nl-NL');
    if (module === 'family_memory') return String(b.date || '').localeCompare(String(a.date || ''));
    return Number(b.pinned || b.important || b.favorite) - Number(a.pinned || a.important || a.favorite) || Number(a.sortPosition || 0) - Number(b.sortPosition || 0) || String(a[definition.dateField] || '9999').localeCompare(String(b[definition.dateField] || '9999')) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  const summary = document.querySelector('#assistant-summary');
  if (summary) {
    if (module === 'family_memory') {
      const files = await repositories.files.getAll();
      const photoIds = new Set(items.map((item) => item.photoFileId).filter(Boolean));
      const bytes = files.filter((file) => photoIds.has(file.id)).reduce((total, file) => total + Number(file.size || 0), 0);
      summary.innerHTML = `<div class="summary-strip"><div><span>Momenten</span><strong>${items.length}</strong></div><div><span>Foto-opslag</span><strong>${(bytes / 1024 / 1024).toFixed(1)} MB</strong></div></div>`;
    } else summary.innerHTML = moduleSummary(module, items);
  }
  root.innerHTML = items.length ? `<div class="content-grid two assistant-grid">${items.map((record) => cardHtml(module, definition, record)).join('')}</div>` : emptyState(`Nog geen ${definition.title.toLocaleLowerCase('nl-NL')}`, definition.description, `<button class="button" data-add-assistant>＋ Toevoegen</button>`);
}

function wasteCalendar(records) {
  const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const days = new Date(year, month + 1, 0).getDate();
  return `<div class="waste-calendar" aria-label="Afvalkalender ${now.toLocaleDateString('nl-NL',{month:'long',year:'numeric'})}">${Array.from({length:days},(_,index)=>{const day=index+1;const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const entries=records.filter((item)=>item.date===key);return `<div class="waste-day ${entries.length?'has-waste':''}"><strong>${day}</strong>${entries.map((item)=>`<span>${e(item.wasteType)}</span>`).join('')}</div>`}).join('')}</div>`;
}

function moduleSummary(module, records) {
  if (module === 'subscription') { const summary = subscriptionSummary(records); return `<div class="summary-strip"><div><span>Actief</span><strong>${summary.count}</strong></div><div><span>Per maand</span><strong>${formatCurrency(summary.monthly,appState.settings.currency)}</strong></div><div><span>Per jaar</span><strong>${formatCurrency(summary.yearly,appState.settings.currency)}</strong></div></div>`; }
  if (module === 'price_history') { const stats = priceHistoryStats(records); return `<div class="summary-strip"><div><span>Registraties</span><strong>${stats.count}</strong></div><div><span>Laagste eenheidsprijs</span><strong>${formatCurrency(stats.lowest,appState.settings.currency)}</strong></div><div><span>Hoogste</span><strong>${formatCurrency(stats.highest,appState.settings.currency)}</strong></div><div><span>Goedkoopste winkel</span><strong>${e(stats.cheapestStore||'—')}</strong></div></div>`; }
  if (module === 'reward') {
    const active = records.filter((record) => record.status === 'active').length;
    const achieved = records.filter((record) => record.status === 'achieved').length;
    const automatic = records.filter((record) => record.autoRule).length;
    return `<div class="summary-strip"><div><span>Actief</span><strong>${active}</strong></div><div><span>Automatisch</span><strong>${automatic}</strong></div><div><span>Behaald</span><strong>${achieved}</strong></div></div><p class="starter-summary-note">Rond taken af: passende uitdagingen lopen vanzelf mee. Wekelijkse en maandelijkse starters beginnen automatisch opnieuw in een nieuwe periode.</p>`;
  }
  if (module === 'waste') return wasteCalendar(records);
  return '';
}

function openSavingsChange(module, record) {
  openModal({ title: `Bedrag bijwerken · ${record.name}`, content: '<div class="form-grid"><div class="field"><label for="savings-amount">Bedrag *</label><input id="savings-amount" name="amount" type="number" step="0.01" required><small>Gebruik een negatief bedrag voor een opname.</small></div><div class="field"><label for="savings-note">Omschrijving</label><input id="savings-note" name="note"></div></div>', onSubmit: async (data) => {
    await addSavingsTransaction(repositories.modules[module], record, Number(data.get('amount')), String(data.get('note') || '').trim());
    showToast('Spaardoel bijgewerkt.'); await refreshAssistant();
  } });
}

async function assertNoActiveLinks(repository, ids = [], label = 'items') {
  for (const id of ids) {
    if (await repository.getById(id)) throw new Error(`De ${label} van dit onderdeel zijn al gekoppeld. Verwijder of pas de bestaande koppeling eerst aan.`);
  }
}

function openProjectExpense(record) {
  const memberOptionsHtml = (appState.settings.members || []).map((member) => `<option value="${e(member.id)}">${e(member.name)}</option>`).join('');
  const categoryOptions = (appState.settings.categories.expenses || []).map((category) => `<option value="${e(category)}">${e(category)}</option>`).join('');
  openModal({
    title: `Kosten boeken · ${record.title}`,
    content: `<div class="form-grid"><div class="field"><label for="project-expense-amount">Bedrag *</label><input id="project-expense-amount" name="amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label for="project-expense-date">Datum *</label><input id="project-expense-date" name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label for="project-expense-category">Categorie</label><select id="project-expense-category" name="category">${categoryOptions}</select></div><div class="field"><label for="project-expense-member">Betaald door</label><select id="project-expense-member" name="paidBy">${memberOptionsHtml}</select></div><div class="field full"><label for="project-expense-note">Notitie</label><input id="project-expense-note" name="note"></div></div>`,
    onSubmit: async (data) => {
      const amount = Number(data.get('amount'));
      if (!(amount > 0)) throw new Error('Vul een bedrag hoger dan nul in.');
      const expense = await repositories.expenses.create({ amount, date: String(data.get('date')), category: String(data.get('category') || 'Overig'), description: `Project ${record.title}`, paymentMethod: 'Overig', paidBy: String(data.get('paidBy') || ''), note: String(data.get('note') || '') });
      await repositories.modules.home_project.update(record.id, { expenseIds: [...new Set([...(record.expenseIds || []), expense.id])], actualCosts: Number(record.actualCosts || 0) + amount });
      showToast('Projectkosten als uitgave geboekt.');
      await refreshAssistant();
    }
  });
}

export const assistantView = {
  async render() {
    const { module, definition } = activeModule();
    if (!definition) return `<section class="page-stack">${emptyState('Onderdeel niet gevonden', 'Ga terug naar Meer en kies een onderdeel.')}</section>`;
    const typeField = definition.fields.find((field) => field.type === 'select' && field.name !== 'status');
    const memberField = definition.fields.find((field) => ['member', 'members'].includes(field.type));
    const typeFilter = typeField ? `<div class="field"><label for="assistant-type">${e(typeField.label)}</label><select id="assistant-type" data-field="${e(typeField.name)}"><option value="all">Alle</option>${(typeField.options || []).map((option) => optionHtml(option, '')).join('')}</select></div>` : '';
    const memberFilter = memberField ? `<div class="field"><label for="assistant-member">Gezinslid</label><select id="assistant-member" data-field="${e(memberField.name)}"><option value="all">Alle gezinsleden</option>${memberOptions('', false)}</select></div>` : '';
    const expiredFilter = module === 'notice' ? '<label class="check-row assistant-expired"><input id="assistant-expired" type="checkbox"> Verlopen berichten tonen</label>' : '';
    const memoryFilter = module === 'family_memory' ? '<div class="field"><label for="assistant-memory-view">Weergave</label><select id="assistant-memory-view"><option value="timeline">Tijdlijn</option><option value="month">Deze maand</option><option value="year">Dit jaar</option><option value="favorites">Favorieten</option></select></div>' : '';
    const bucketSort = module === 'bucket_list' ? '<div class="field"><label for="assistant-sort">Sorteren</label><select id="assistant-sort"><option value="default">Favorieten en datum</option><option value="cost-low">Kosten laag-hoog</option><option value="cost-high">Kosten hoog-laag</option><option value="season">Beste seizoen</option></select></div>' : '';
    return `<section class="page-stack assistant-page" data-module="${e(module)}"><div class="page-header"><div><p class="eyebrow">${e(definition.group)}</p><h2>${e(definition.title)}</h2><p class="muted">${e(definition.description)}</p></div><div class="page-actions">${module==='inbox'?'<button class="button secondary" data-archive-inbox>Verwerkte/selectie archiveren</button>':''}${module==='bucket_list'?'<button class="button secondary" data-random-bucket>Willekeurig idee</button>':''}${module==='family_memory'?'<button class="button secondary" data-print-timeline>Tijdlijn printen</button>':''}<button class="button" data-add-assistant>＋ ${e(definition.singular)}</button></div></div><div id="assistant-summary"></div><div class="toolbar assistant-toolbar"><div class="field grow"><label for="assistant-search">Zoeken</label><input id="assistant-search" type="search" placeholder="Zoek in ${e(definition.title.toLocaleLowerCase('nl-NL'))}"></div><div class="field"><label for="assistant-status">Status</label><select id="assistant-status"><option value="all">Alle statussen</option><option value="active">Actief</option><option value="planned">Gepland</option><option value="done">Afgerond</option><option value="archived">Gearchiveerd</option></select></div>${typeFilter}${memberFilter}${memoryFilter}${bucketSort}${expiredFilter}</div><div id="assistant-list" aria-live="polite"></div></section>`;
  },
  async mount(root) {
    const { module, definition, query } = activeModule();
    if (!definition) return;
    root.querySelector('#assistant-search')?.addEventListener('input', () => refreshAssistant().catch(handleError));
    root.querySelector('#assistant-status')?.addEventListener('change', () => refreshAssistant().catch(handleError));
    root.querySelector('#assistant-type')?.addEventListener('change', () => refreshAssistant().catch(handleError));
    root.querySelector('#assistant-member')?.addEventListener('change', () => refreshAssistant().catch(handleError));
    root.querySelector('#assistant-memory-view')?.addEventListener('change', () => refreshAssistant().catch(handleError));
    root.querySelector('#assistant-sort')?.addEventListener('change', () => refreshAssistant().catch(handleError));
    root.querySelector('#assistant-expired')?.addEventListener('change', () => refreshAssistant().catch(handleError));
    bindAction(root, '[data-add-assistant]', () => openAssistantForm(module));
    bindAction(root, '[data-edit-assistant]', async (button) => { const record = await repositories.modules[module].getById(button.dataset.editAssistant); if (record) openAssistantForm(module, record); });
    bindAction(root, '[data-copy-assistant]', async (button) => { const record = await repositories.modules[module].getById(button.dataset.copyAssistant); if (!record) return; const copy = { ...record, [definition.titleField]: `${recordTitle(definition, record)} (kopie)` }; ['id','createdAt','updatedAt','deletedAt','version','deviceId','syncStatus','updatedBy','createdBy','conflictData'].forEach((key) => delete copy[key]); await repositories.modules[module].create(copy); showToast('Kopie gemaakt.'); await refreshAssistant(); });
    bindAction(root, '[data-delete-assistant]', async (button) => { const record = await repositories.modules[module].getById(button.dataset.deleteAssistant); if (record && await confirmDialog({ message: `“${e(recordTitle(definition, record))}” gaat naar de prullenbak.` })) { await repositories.modules[module].softDelete(record.id); showToast('Item naar de prullenbak verplaatst.'); await refreshAssistant(); } });
    bindAction(root, '[data-archive-assistant]', async (button) => { const record = await repositories.modules[module].getById(button.dataset.archiveAssistant); if (!record) return; await repositories.modules[module].update(record.id, { status: record.status === 'archived' ? 'active' : 'archived' }); await refreshAssistant(); });
    bindAction(root, '[data-convert-assistant]', async (button) => { const record = await repositories.modules[module].getById(button.dataset.convertAssistant); if (!record) return; const result = await convertAssistantRecord({ module, record, target: button.dataset.convertTarget, repositories }); showToast(result.duplicate ? 'Het gekoppelde item bestond al.' : `${conversionLabels[button.dataset.convertTarget]} aangemaakt.`); await refreshAssistant(); });
    bindAction(root, '[data-return-loan]', async (button) => { await repositories.modules.loan.update(button.dataset.returnLoan, { status: 'returned', actualReturnDate: new Date().toISOString().slice(0, 10) }); showToast('Als teruggebracht gemarkeerd.'); await refreshAssistant(); });
    bindAction(root, '[data-process-inbox]', async (button) => { await repositories.modules.inbox.update(button.dataset.processInbox, { processed: true }); showToast('Inbox-item is verwerkt.'); await refreshAssistant(); });
    bindAction(root, '[data-activate-mode]', async (button) => { const modes = await repositories.modules.family_mode.getAll(); for (const item of modes.filter((mode) => mode.active && mode.id !== button.dataset.activateMode)) await repositories.modules.family_mode.update(item.id, { active: false }); await repositories.modules.family_mode.update(button.dataset.activateMode, { active: true }); showToast('Gezinsmodus geactiveerd.'); await refreshAssistant(); });
    bindAction(root, '[data-complete-maintenance]', async (button) => { const record = await repositories.modules.maintenance.getById(button.dataset.completeMaintenance); await completeMaintenance(repositories.modules.maintenance, record); showToast('Onderhoud en geschiedenis bijgewerkt.'); await refreshAssistant(); });
    bindAction(root, '[data-appliance-maintenance]', async (button) => { const record = await repositories.modules.appliance.getById(button.dataset.applianceMaintenance); const maintenance = await repositories.modules.maintenance.create({ title: `Onderhoud ${record.name}`, description: [record.brand, record.model].filter(Boolean).join(' '), category: 'Elektrische apparaten', location: record.storageLocation || '', assignedTo: '', lastDate: '', nextDate: '', recurrence: '', estimatedCost: 0, actualCost: 0, history: [], notes: `Gekoppeld apparaat: ${record.name}`, status: 'planned' }); await repositories.modules.appliance.update(record.id, { maintenanceId: maintenance.id }); showToast('Onderhoudstaak gekoppeld.'); await refreshAssistant(); });
    bindAction(root, '[data-complete-waste]', async (button) => { const record = await repositories.modules.waste.getById(button.dataset.completeWaste); await completeWaste(repositories.modules.waste, record); showToast(record.putOutside ? 'Container is binnen; een volgende herhaling is zo nodig aangemaakt.' : 'Container staat buiten.'); await refreshAssistant(); });
    bindAction(root, '[data-reward-point]', async (button) => { const record = await repositories.modules.reward.getById(button.dataset.rewardPoint); await addRewardProgress(repositories.modules.reward, record, 1, record.approvedBy); showToast('Voortgang bijgewerkt.'); await refreshAssistant(); });
    bindAction(root, '[data-savings-change]', async (button) => { const record = await repositories.modules.savings_goal.getById(button.dataset.savingsChange); if (record) openSavingsChange(module, record); });
    bindAction(root, '[data-copy-location]', async (button) => { const record = await repositories.modules.storage_location.getById(button.dataset.copyLocation); if (!record) return; const location = [record.room, record.cupboard, record.shelf, record.drawer, record.box, record.temporaryLocation].filter(Boolean).join(' · '); await navigator.clipboard.writeText(location); await repositories.modules.storage_location.update(record.id, { searchCount: Number(record.searchCount || 0) + 1 }); showToast('Opslaglocatie gekopieerd.'); await refreshAssistant(); });
    bindAction(root, '[data-read-notice]', async (button) => { const record = await repositories.modules.notice.getById(button.dataset.readNotice); const actor = services.auth.user?.id || 'device'; await repositories.modules.notice.update(record.id, { readBy: [...new Set([...(record.readBy||[]),actor])] }); showToast('Als gelezen gemarkeerd.'); await refreshAssistant(); });
    bindAction(root, '[data-archive-inbox]', async () => { const selected=[...root.querySelectorAll('[data-inbox-select]:checked')].map((input)=>input.dataset.inboxSelect); const items=await repositories.modules.inbox.getAll(); const targets=items.filter((item)=>selected.includes(item.id)||(!selected.length&&item.processed)); if(!targets.length)throw new Error('Selecteer items of markeer ze eerst als verwerkt.'); for(const item of targets)await repositories.modules.inbox.update(item.id,{status:'archived'}); showToast(`${targets.length} inbox-item${targets.length===1?'':'s'} gearchiveerd.`); await refreshAssistant(); });
    bindAction(root, '[data-visit-shopping]', async (button) => {
      const record = await repositories.modules.visit_plan.getById(button.dataset.visitShopping);
      await assertNoActiveLinks(repositories.shopping, record.shoppingIds, 'boodschappen');
      const names = record.foodAndDrink || [];
      if (!names.length) throw new Error('Voeg eerst eten of drinken toe aan het bezoekplan.');
      const ids = [];
      for (const name of names) { const item = await repositories.shopping.create({ productName: name, quantity: 1, unit: 'stuks', category: 'Overig', store: '', note: `Voor ${record.title}`, addedBy: 'device', checked: false, checkedAt: null, checkedBy: null }); ids.push(item.id); }
      await repositories.modules.visit_plan.update(record.id, { shoppingIds: ids });
      showToast('Eten en drinken gekoppeld aan boodschappen.'); await refreshAssistant();
    });
    bindAction(root, '[data-visit-tasks]', async (button) => {
      const record = await repositories.modules.visit_plan.getById(button.dataset.visitTasks);
      await assertNoActiveLinks(repositories.tasks, record.taskIds, 'taken');
      const steps = (record.cleanupChecklist || []).filter((item) => !item.done);
      if (!steps.length) throw new Error('Er staan geen open opruimregels in dit bezoekplan.');
      const ids = [];
      for (const item of steps) { const task = await repositories.tasks.create({ title: item.text, description: `Opruimen voor ${record.title}`, assignedTo: item.memberId || '', date: record.date || new Date().toISOString().slice(0, 10), time: '', priority: 'normal', category: 'Huishouden', recurrence: 'none', status: 'open', notes: item.note || '' }); ids.push(task.id); }
      await repositories.modules.visit_plan.update(record.id, { taskIds: ids });
      showToast('Opruimtaken gekoppeld.'); await refreshAssistant();
    });
    bindAction(root, '[data-project-tasks]', async (button) => {
      const record = await repositories.modules.home_project.getById(button.dataset.projectTasks);
      await assertNoActiveLinks(repositories.tasks, record.taskIds, 'projecttaken');
      const steps = (record.steps || []).filter((item) => !item.done);
      if (!steps.length) throw new Error('Dit project heeft geen open stappen.');
      const ids = [];
      for (const item of steps) { const task = await repositories.tasks.create({ title: item.text, description: `Project ${record.title}`, assignedTo: item.memberId || '', date: record.startDate || new Date().toISOString().slice(0, 10), time: '', priority: 'normal', category: 'Klusproject', recurrence: 'none', status: 'open', notes: item.note || '' }); ids.push(task.id); }
      await repositories.modules.home_project.update(record.id, { taskIds: ids });
      showToast('Projectstappen als taken gekoppeld.'); await refreshAssistant();
    });
    bindAction(root, '[data-project-shopping]', async (button) => {
      const record = await repositories.modules.home_project.getById(button.dataset.projectShopping);
      await assertNoActiveLinks(repositories.shopping, record.shoppingIds, 'projectboodschappen');
      const names = record.materials || [];
      if (!names.length) throw new Error('Voeg eerst materialen aan dit project toe.');
      const ids = [];
      for (const name of names) { const item = await repositories.shopping.create({ productName: name, quantity: 1, unit: 'stuks', category: 'Huishouden', store: '', note: `Project ${record.title}`, addedBy: 'device', checked: false, checkedAt: null, checkedBy: null }); ids.push(item.id); }
      await repositories.modules.home_project.update(record.id, { shoppingIds: ids });
      showToast('Materialen aan boodschappen gekoppeld.'); await refreshAssistant();
    });
    bindAction(root, '[data-project-expense]', async (button) => { const record = await repositories.modules.home_project.getById(button.dataset.projectExpense); if (record) openProjectExpense(record); });
    bindAction(root, '[data-complete-bucket]', async (button) => { await repositories.modules.bucket_list.update(button.dataset.completeBucket, { completed: true, completedDate: new Date().toISOString().slice(0, 10) }); showToast('Bucketlistidee afgerond.'); await refreshAssistant(); });
    bindAction(root, '[data-bucket-memory]', async (button) => { const record = await repositories.modules.bucket_list.getById(button.dataset.bucketMemory); const moment = await repositories.modules.family_memory.create({ date: record.completedDate || new Date().toISOString().slice(0, 10), title: record.activity, text: record.notes || '', memberIds: record.memberIds || [], category: 'Bucketlist', favorite: Boolean(record.favorite), location: record.location || '', photoFileId: record.photoFileId || null, status: 'active' }); showToast('Gezinsmoment aangemaakt.'); location.hash = `#assistant?module=family_memory&focus=${moment.id}`; });
    bindAction(root, '[data-random-bucket]', async () => { const items = (await repositories.modules.bucket_list.getAll()).filter((item) => !item.completed); if (!items.length) throw new Error('Er zijn geen open bucketlistideeën.'); const item = items[Math.floor(Math.random() * items.length)]; showToast(`Idee voor jullie: ${recordTitle(definition, item)}`, 'success', 6000); });
    bindAction(root, '[data-print-profile], [data-print-memory], [data-print-timeline]', () => window.print());
    bindAction(root, '[data-print-location]', async (button) => {
      const record = await repositories.modules.storage_location.getById(button.dataset.printLocation);
      if (!record) return;
      const modal = openModal({
        title: 'Opslaglabel',
        onSubmit: null,
        content: `<div class="storage-label"><strong>${e(record.item)}</strong><p>${e([record.room,record.cupboard,record.shelf,record.drawer,record.box].filter(Boolean).join(' · '))}</p><code>ST-${e(record.id.slice(0,8).toUpperCase())}</code><button class="button" type="button" data-print-storage-label>Label afdrukken</button></div>`
      });
      modal.querySelector('[data-print-storage-label]')?.addEventListener('click', () => window.print());
    });
    bindAction(root, '[data-print-emergency]', () => window.print());
    await refreshAssistant();
    if (query.get('new') === '1') openAssistantForm(module);
  }
};
