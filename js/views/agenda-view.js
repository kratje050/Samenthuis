import { repositories, services, appState } from '../state.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { datePicker } from '../components/date-picker.js';
import { timePicker } from '../components/time-picker.js';
import { monthRange, renderMonthCalendar } from '../components/calendar-month.js';
import { weekRange, renderWeekCalendar } from '../components/calendar-week.js';
import { renderDayCalendar } from '../components/calendar-day.js';
import { addDays, addMonths, endOfMonth, formatDate, fromDateKey, startOfMonth, toDateKey } from '../utils/dates.js';
import { validateAppointment } from '../services/validation-service.js';
import { downloadIcs, icsToAppointments } from '../services/ics-service.js';
import { arrayValue, bindAction, boolValue, categoryColor, consumeHashAction, e, emptyState, field, handleError, numberValue, textArea, value } from './view-helpers.js';
import { icon } from '../utils/icons.js';
import { openBirthdayDialog } from '../components/birthday-dialog.js';

let mode = 'today';
let cursor = new Date();
let filters = { member: '', category: '', query: '' };

function consumeBirthdayAction() {
  const [base, query = ''] = location.hash.split('?');
  const matches = new URLSearchParams(query).get('birthday') === '1';
  if (matches) history.replaceState(null, '', base);
  return matches;
}

function appointmentForm(record = {}) {
  const settings = appState.settings;
  const memberChecks = settings.members.map((member) => `<label><input type="checkbox" name="members" value="${e(member.id)}" ${(record.members || []).includes(member.id) ? 'checked' : ''}> <span class="member-dot" style="--member-color:${member.color}"></span>${e(member.name)}</label>`).join('');
  const recurrenceOptions = [
    { value: 'none', label: 'Niet herhalen' }, { value: 'daily', label: 'Dagelijks' }, { value: 'weekdays', label: 'Iedere werkdag' },
    { value: 'weekly', label: 'Wekelijks' }, { value: 'biweekly', label: 'Iedere twee weken' }, { value: 'monthly', label: 'Maandelijks' },
    { value: 'yearly', label: 'Jaarlijks' }, { value: 'custom', label: 'Eigen interval' }
  ];
  const reminderOptions = [
    { value: 'none', label: 'Geen herinnering' }, { value: 'at_time', label: 'Op het moment zelf' }, { value: 'min15', label: '15 minuten vooraf' },
    { value: 'min30', label: '30 minuten vooraf' }, { value: 'hour1', label: '1 uur vooraf' }, { value: 'day1', label: '1 dag vooraf' }, { value: 'custom', label: 'Eigen tijd vooraf' }
  ];
  return `<div class="form-grid">
    ${field('title', 'Titel', record, { required: true, className: 'full', placeholder: 'Bijvoorbeeld: zwemles' })}
    ${datePicker('date', 'Datum', record.date || toDateKey(), { required: true, className: 'full appointment-date' })}
    <div class="field full appointment-all-day"><label class="check-row"><input id="allDay" name="allDay" type="checkbox" ${record.allDay ? 'checked' : ''}> Afspraak zonder tijd</label></div>
    ${timePicker('startTime', 'Begintijd', record.startTime || '', { className: 'appointment-time' })}${timePicker('endTime', 'Eindtijd', record.endTime || '', { className: 'appointment-time' })}
    <fieldset class="full"><legend>Gezinsleden</legend><div class="check-grid">${memberChecks}</div></fieldset>
    ${field('category', 'Categorie', { category: record.category || 'Gezin' }, { className: 'full', options: settings.categories.appointments })}
    ${field('location', 'Locatie', record, { className: 'full' })}
    ${textArea('notes', 'Notities', record, 'full')}
    ${field('recurrence', 'Herhaling', { recurrence: record.recurrence || 'none' }, { className: 'full', options: recurrenceOptions })}
    ${datePicker('recurrenceUntil', 'Herhalen tot', record.recurrenceUntil || '', { className: 'full', min: record.date || toDateKey() })}
    <div class="field recurrence-custom"><label for="recurrenceInterval">Iedere</label><input id="recurrenceInterval" name="recurrenceInterval" type="number" min="1" value="${record.recurrenceInterval || 1}"></div>
    ${field('recurrenceUnit', 'Intervaleenheid', { recurrenceUnit: record.recurrenceUnit || 'days' }, { className: 'recurrence-custom', options: [{value:'days',label:'dag(en)'},{value:'weeks',label:'week/weken'},{value:'months',label:'maand(en)'}] })}
    ${field('reminder', 'Herinnering', { reminder: record.reminder || 'none' }, { className: 'full', options: reminderOptions })}
    ${field('reminderCustom', 'Eigen minuten vooraf', record, { type: 'number', min: '0', className: 'full' })}
    ${textArea('description', 'Omschrijving (optioneel)', record, 'full')}
  </div>`;
}

function openAppointment(record = null, copy = false) {
  const source = record ? { ...record, id: undefined, title: copy ? `${record.title} (kopie)` : record.title } : {};
  const editing = record && !copy;
  const modal = openModal({
    title: editing ? 'Afspraak aanpassen' : 'Nieuwe afspraak', content: appointmentForm(source), submitLabel: 'Opslaan', wide: true,
    onSubmit: async (data) => {
      const members = arrayValue(data, 'members');
      const appointment = {
        title: value(data, 'title'), description: value(data, 'description'), date: value(data, 'date'),
        allDay: boolValue(data, 'allDay'), startTime: value(data, 'startTime'), endTime: value(data, 'endTime'),
        location: value(data, 'location'), category: value(data, 'category'), members,
        memberNames: members.map((id) => appState.settings.members.find((member) => member.id === id)?.name).filter(Boolean),
        recurrence: value(data, 'recurrence', 'none'), recurrenceUntil: value(data, 'recurrenceUntil') || null,
        recurrenceInterval: numberValue(data, 'recurrenceInterval', 1), recurrenceUnit: value(data, 'recurrenceUnit', 'days'),
        reminder: value(data, 'reminder', 'none'), reminderCustom: numberValue(data, 'reminderCustom', 0), notes: value(data, 'notes'),
        completed: editing ? Boolean(record.completed) : false
      };
      if (appointment.category === 'Verjaardag') {
        appointment.birthdayName = appointment.title.replace(/\s+is jarig$/i, '');
        appointment.birthYear = Number(appointment.date.slice(0, 4));
      }
      validateAppointment(appointment);
      if (editing) await repositories.appointments.update(record.id, appointment);
      else await repositories.appointments.create(appointment);
      showToast(editing ? 'Afspraak aangepast.' : 'Afspraak toegevoegd.');
      await refresh();
    }
  });
  const allDay = modal.querySelector('#allDay');
  const toggleTime = () => modal.querySelectorAll('[name="startTime"], [name="endTime"]').forEach((input) => { input.disabled = allDay.checked; });
  allDay.addEventListener('change', toggleTime); toggleTime();
  const recurrence = modal.querySelector('[name="recurrence"]');
  const toggleRecurrence = () => modal.querySelectorAll('.recurrence-custom').forEach((field) => field.hidden = recurrence.value !== 'custom');
  recurrence.addEventListener('change', toggleRecurrence); toggleRecurrence();
}

function rangeForMode() {
  if (mode === 'today' || mode === 'day') return { start: fromDateKey(toDateKey(cursor)), end: fromDateKey(toDateKey(cursor), '23:59') };
  if (mode === 'week') return weekRange(cursor);
  if (mode === 'month') return monthRange(cursor);
  if (mode === 'upcoming') return { start: new Date(), end: addDays(new Date(), 90) };
  return { start: addDays(new Date(), -365), end: addDays(new Date(), 730) };
}

function rangeLabel() {
  if (mode === 'today') return 'Vandaag';
  if (mode === 'day') return formatDate(cursor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (mode === 'week') { const range = weekRange(cursor); return `${formatDate(range.start, { day:'numeric', month:'short' })} – ${formatDate(range.end, { day:'numeric', month:'short', year:'numeric' })}`; }
  if (mode === 'month') return formatDate(cursor, { month: 'long', year: 'numeric' });
  if (mode === 'upcoming') return 'Komende 90 dagen';
  if (mode === 'deleted') return 'Verwijderde afspraken';
  return 'Alle afspraken';
}

async function refresh() {
  const content = document.querySelector('#agenda-content');
  if (!content) return;
  document.querySelectorAll('[data-agenda-mode]').forEach((button) => button.classList.toggle('active', button.dataset.agendaMode === mode));
  document.querySelector('#agenda-range-label').textContent = rangeLabel();
  const navigable = ['day', 'week', 'month'].includes(mode);
  document.querySelector('#agenda-prev').hidden = !navigable;
  document.querySelector('#agenda-next').hidden = !navigable;
  if (mode === 'deleted') {
    const deleted = (await repositories.appointments.getAll({ includeDeleted: true })).filter((item) => item.deletedAt);
    content.innerHTML = deleted.length ? `<ul class="item-list">${deleted.map((item) => `<li class="list-item"><div class="list-item-main"><h3 class="list-item-title">${e(item.title)}</h3><div class="list-item-meta"><span>${e(item.date)}</span><span>Verwijderd op ${e(item.deletedAt.slice(0,10))}</span></div></div><button class="button small secondary" data-restore-appointment="${item.id}">Herstellen</button></li>`).join('')}</ul>` : emptyState('Prullenbak is leeg', 'Er zijn geen verwijderde afspraken.');
    return;
  }
  const range = rangeForMode();
  const occurrences = await services.agenda.occurrencesBetween(range.start, range.end, filters);
  if (mode === 'month') content.innerHTML = renderMonthCalendar(cursor, occurrences, categoryColor);
  else if (mode === 'week') content.innerHTML = renderWeekCalendar(cursor, occurrences, categoryColor);
  else content.innerHTML = renderDayCalendar(occurrences, appState.settings.members, categoryColor);
}

export const agendaView = {
  async render() {
    const settings = appState.settings;
    return `<section class="page-stack agenda-page">
      <div class="page-header agenda-desktop-actions"><p class="muted">Eén gezamenlijke gezinsagenda, altijd offline beschikbaar.</p><div class="page-actions"><button class="button secondary" id="import-ics">Importeren</button><button class="button secondary" id="export-ics">Exporteren</button><button class="button secondary" type="button" data-add-birthday>${icon('birthday')} Verjaardag toevoegen</button><button class="button" id="new-appointment">${icon('plus')} Nieuwe afspraak</button><input class="sr-only" id="ics-file" type="file" accept="text/calendar,.ics"></div></div>
      <div class="segmented agenda-modes" aria-label="Agendaweergave">${[['today','Vandaag'],['week','Week'],['month','Maand'],['upcoming','Komend'],['day','Dag'],['list','Lijst'],['deleted','Prullenbak']].map(([key,label]) => `<button type="button" data-agenda-mode="${key}">${label}</button>`).join('')}</div>
      <button class="button secondary agenda-birthday-action" type="button" data-add-birthday>${icon('birthday')} Verjaardag toevoegen</button>
      <details class="filter-panel"><summary>${icon('search')} Zoeken en filteren</summary><div class="toolbar"><div class="field grow"><label for="agenda-search">Zoeken</label><input id="agenda-search" type="search" placeholder="Titel, locatie, categorie of notitie" value="${e(filters.query)}"></div>
        ${field('member-filter','Gezinslid',{ 'member-filter': filters.member },{ options:[{value:'',label:'Alle gezinsleden'},...settings.members.map((member)=>({value:member.id,label:member.name}))] })}
        ${field('category-filter','Categorie',{ 'category-filter': filters.category },{ options:[{value:'',label:'Alle categorieën'},...settings.categories.appointments] })}</div></details>
      <div class="agenda-date-nav"><button class="icon-button" id="agenda-prev" aria-label="Vorige periode">${icon('chevron-left')}</button><h2 id="agenda-range-label"></h2><button class="icon-button" id="agenda-next" aria-label="Volgende periode">${icon('chevron-right')}</button></div>
      <div id="agenda-content"></div>
      <div class="agenda-member-strip">${settings.members.map((member) => `<button type="button" data-member-shortcut="${e(member.id)}"><span class="member-avatar" style="--member-color:${member.color}">${e(String(member.icon || member.name).slice(0, 1))}</span><span>${e(member.name)}</span><i style="--member-color:${member.color}"></i></button>`).join('')}</div>
    </section>`;
  },
  async mount(root) {
    root.querySelector('#new-appointment').addEventListener('click', () => openAppointment());
    bindAction(root, '[data-add-birthday]', () => openBirthdayDialog({ onSaved: refresh }));
    root.querySelector('#export-ics').addEventListener('click', async () => { const records = await repositories.appointments.getAll(); downloadIcs(records); showToast(`${records.length} afspraak${records.length===1?'':'en'} geëxporteerd.`); });
    root.querySelector('#import-ics').addEventListener('click', () => root.querySelector('#ics-file').click());
    root.querySelector('#ics-file').addEventListener('change', async (event) => {
      const file = event.target.files[0]; if (!file) return;
      try {
        const incoming = icsToAppointments(await file.text());
        if (!incoming.length) throw new Error('Het bestand bevat geen bruikbare afspraken.');
        if (!await confirmDialog({ title:'Agenda importeren?', message:`${incoming.length} afspraak${incoming.length===1?'':'en'} worden toegevoegd of bijgewerkt.`, confirmLabel:'Importeren', danger:false })) return;
        const existing = await repositories.appointments.getAll({includeDeleted:true}); const byUid = new Map(existing.filter((item)=>item.externalUid).map((item)=>[item.externalUid,item]));
        let created=0,updated=0;
        for (const item of incoming) { const match=byUid.get(item.externalUid); if(match){await repositories.appointments.update(match.id,item);updated++}else{await repositories.appointments.create(item);created++} }
        showToast(`${created} toegevoegd, ${updated} bijgewerkt.`); await refresh();
      } catch(error) { handleError(error); } finally { event.target.value=''; }
    });
    root.querySelectorAll('[data-agenda-mode]').forEach((button) => button.addEventListener('click', async () => { mode = button.dataset.agendaMode; if (mode === 'today') cursor = new Date(); await refresh(); }));
    root.querySelector('#agenda-search').addEventListener('input', async (event) => { filters.query = event.target.value; await refresh(); });
    root.querySelector('[name="member-filter"]').addEventListener('change', async (event) => { filters.member = event.target.value; await refresh(); });
    root.querySelector('[name="category-filter"]').addEventListener('change', async (event) => { filters.category = event.target.value; await refresh(); });
    root.querySelectorAll('[data-member-shortcut]').forEach((button) => button.addEventListener('click', async () => {
      filters.member = filters.member === button.dataset.memberShortcut ? '' : button.dataset.memberShortcut;
      root.querySelector('[name="member-filter"]').value = filters.member;
      root.querySelectorAll('[data-member-shortcut]').forEach((item) => item.classList.toggle('active', item.dataset.memberShortcut === filters.member));
      await refresh();
    }));
    const move = async (direction) => { cursor = mode === 'month' ? addMonths(cursor, direction) : addDays(cursor, direction * (mode === 'week' ? 7 : 1)); await refresh(); };
    root.querySelector('#agenda-prev').addEventListener('click', () => move(-1)); root.querySelector('#agenda-next').addEventListener('click', () => move(1));
    bindAction(root, '[data-open-day]', async (button) => { cursor = fromDateKey(button.dataset.openDay); mode = 'day'; await refresh(); });
    bindAction(root, '[data-edit-appointment]', async (button) => { const record = await repositories.appointments.getById(button.dataset.editAppointment); if (record) openAppointment(record); });
    bindAction(root, '[data-copy-appointment]', async (button) => { const record = await repositories.appointments.getById(button.dataset.copyAppointment); if (record) openAppointment(record, true); });
    bindAction(root, '[data-complete-appointment]', async (button) => { const record = await repositories.appointments.getById(button.dataset.completeAppointment); await repositories.appointments.update(record.id, { completed: !record.completed }); showToast(record.completed ? 'Afspraak heropend.' : 'Afspraak afgerond.'); await refresh(); });
    bindAction(root, '[data-delete-appointment]', async (button) => { const record = await repositories.appointments.getById(button.dataset.deleteAppointment); if (record && await confirmDialog({ message: `“${e(record.title)}” wordt naar de prullenbak verplaatst.` })) { await repositories.appointments.softDelete(record.id); showToast('Afspraak verwijderd.'); await refresh(); } });
    bindAction(root, '[data-restore-appointment]', async (button) => { await repositories.appointments.restore(button.dataset.restoreAppointment); showToast('Afspraak hersteld.'); await refresh(); });
    await refresh().catch(handleError);
    if (consumeHashAction('1')) openAppointment();
    else if (consumeBirthdayAction()) openBirthdayDialog({ onSaved: refresh });
  }
};
