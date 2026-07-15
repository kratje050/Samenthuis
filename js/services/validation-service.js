import { isUuid } from '../utils/uuid.js';

export function requireFields(data, fields) {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null || String(data[field]).trim() === '');
  if (missing.length) throw new Error(`Vul de verplichte velden in: ${missing.join(', ')}.`);
}

export function validateAppointment(data) {
  requireFields(data, ['title', 'date']);
  if (!data.allDay && !data.startTime) throw new Error('Kies een begintijd of markeer de afspraak als zonder tijd.');
  if (!data.allDay && data.endTime && data.startTime > data.endTime) throw new Error('De eindtijd moet na de begintijd liggen.');
  if (data.recurrenceUntil && data.recurrenceUntil < data.date) throw new Error('De einddatum van de herhaling ligt vóór de afspraak.');
  return true;
}

export function validateBackup(backup, { appName, databaseVersion }) {
  if (!backup || typeof backup !== 'object') throw new Error('Dit bestand bevat geen geldige back-up.');
  if (backup.appName !== appName) throw new Error('Dit is geen back-up van Samen Thuis.');
  if (!Number.isInteger(backup.databaseVersion) || backup.databaseVersion > databaseVersion || backup.databaseVersion < 1) throw new Error('Deze databaseversie wordt niet ondersteund.');
  const requiredArrays = ['gezinsleden', 'afspraken', 'boodschappen', 'taken', 'maaltijden', 'voorraad', 'uitgaven', 'huisdieren', 'uitjes', 'outbox'];
  for (const field of requiredArrays) if (!Array.isArray(backup[field])) throw new Error(`De back-up mist het verplichte onderdeel “${field}”.`);
  if (!backup.instellingen || typeof backup.instellingen !== 'object') throw new Error('De back-up bevat geen instellingen.');
  if (!isUuid(backup.instellingen.id)) throw new Error('Het instellingenrecord in de back-up heeft een ongeldige ID.');
  const allRecords = requiredArrays.filter((field) => field !== 'outbox').flatMap((field) => backup[field]);
  const invalid = allRecords.find((record) => !isUuid(record.id));
  if (invalid) throw new Error('De back-up bevat één of meer records met een ongeldige ID.');
  return true;
}
