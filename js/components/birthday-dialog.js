import { repositories, appState } from '../state.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { toDateKey } from '../utils/dates.js';
import { e, field, textArea, value } from '../views/view-helpers.js';

const reminderOptions = [
  { value: 'none', label: 'Geen herinnering' },
  { value: 'at_time', label: 'Op de verjaardag' },
  { value: 'day1', label: '1 dag vooraf' },
  { value: 'min30', label: '30 minuten vooraf' },
  { value: 'hour1', label: '1 uur vooraf' }
];

export function openBirthdayDialog({ onSaved } = {}) {
  const members = appState.settings?.members || [];
  const today = toDateKey();
  return openModal({
    title: 'Verjaardag toevoegen',
    submitLabel: 'Opslaan',
    content: `<div class="form-grid birthday-form">
      ${field('personName', 'Naam', {}, { required: true, className: 'full', placeholder: 'Bijvoorbeeld: Oma' })}
      <div class="field full"><label for="birthDate">Geboortedatum *</label><input id="birthDate" name="birthDate" type="date" max="${e(today)}" required></div>
      ${field('memberId', 'Koppelen aan gezinslid', {}, { className: 'full', options: [{ value: '', label: 'Niet koppelen' }, ...members.map((member) => ({ value: member.id, label: member.name }))] })}
      ${field('reminder', 'Herinnering', { reminder: 'day1' }, { className: 'full', options: reminderOptions })}
      ${textArea('notes', 'Notities', {}, 'full')}
      <p class="form-hint full">De verjaardag komt automatisch ieder jaar terug in de gezamenlijke agenda.</p>
    </div>`,
    onSubmit: async (data) => {
      const personName = value(data, 'personName');
      const birthDate = value(data, 'birthDate');
      const memberId = value(data, 'memberId');
      if (!personName) throw new Error('Vul de naam van de jarige in.');
      if (!birthDate) throw new Error('Kies de geboortedatum.');
      if (birthDate > today) throw new Error('De geboortedatum kan niet in de toekomst liggen.');
      const member = members.find((item) => item.id === memberId);
      const record = await repositories.appointments.create({
        title: `${personName} is jarig`,
        description: `Verjaardag van ${personName}`,
        date: birthDate,
        allDay: true,
        startTime: '',
        endTime: '',
        location: '',
        category: 'Verjaardag',
        members: member ? [member.id] : [],
        memberNames: member ? [member.name] : [],
        recurrence: 'yearly',
        recurrenceUntil: null,
        recurrenceInterval: 1,
        recurrenceUnit: 'months',
        reminder: value(data, 'reminder', 'day1'),
        reminderCustom: 0,
        notes: value(data, 'notes'),
        completed: false,
        birthdayName: personName,
        birthYear: Number(birthDate.slice(0, 4))
      });
      showToast('Verjaardag toegevoegd.');
      await onSaved?.(record);
    }
  });
}
