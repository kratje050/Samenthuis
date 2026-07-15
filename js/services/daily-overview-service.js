import { addDays, fromDateKey, toDateKey } from '../utils/dates.js';

function daysUntil(date, today = toDateKey()) {
  if (!date) return Infinity;
  return Math.ceil((fromDateKey(String(date).slice(0, 10)) - fromDateKey(today)) / 86400000);
}

const cardAliases = new Map([
  ['afspraken', 'appointments'], ['agenda', 'appointments'], ['vertrekken', 'departure'], ['vertrek', 'departure'],
  ['paklijsten', 'packing'], ['meeneemlijsten', 'packing'], ['taken', 'tasks'], ['boodschappen', 'shopping'],
  ['verjaardagen', 'birthdays'], ['huisdieren', 'pets'], ['afval', 'waste'], ['voorraad', 'inventory'],
  ['prikbord', 'notices'], ['routines', 'routines'], ['abonnementen', 'subscriptions'], ['leenlijst', 'loans']
]);

function cardKeys(values = []) {
  return values.map((value) => String(value).trim().toLocaleLowerCase('nl-NL')).map((value) => cardAliases.get(value) || value);
}

export async function buildDailyOverview({ repositories, agenda, settings, now = new Date() }) {
  const today = toDateKey(now);
  const [appointments, tasks, shopping, inventory, pets, notices, packing, routines, waste, subscriptions, loans, familyModes] = await Promise.all([
    agenda.occurrencesBetween(fromDateKey(today), fromDateKey(today, '23:59')),
    repositories.tasks.getAll(), repositories.shopping.getAll(), repositories.inventory.getAll(), repositories.pets.getAll(),
    repositories.modules.notice.getAll(), repositories.modules.packing.getAll(), repositories.modules.routine.getAll(),
    repositories.modules.waste.getAll(), repositories.modules.subscription.getAll(), repositories.modules.loan.getAll(), repositories.modules.family_mode.getAll()
  ]);
  const birthdays = appointments.filter((item) => item.category === 'Verjaardag');
  const ordinaryAppointments = appointments.filter((item) => item.category !== 'Verjaardag');
  const urgentTasks = tasks.filter((item) => item.status !== 'done' && (item.date === today || ['high', 'urgent'].includes(item.priority)));
  const lowOrExpiring = inventory.filter((item) => Number(item.quantity) <= Number(item.minimumQuantity) || daysUntil(item.expiryDate, today) <= 3);
  const petAlerts = pets.flatMap((pet) => [
    ...(pet.medication && pet.medicationTime ? [{ id: pet.id, title: `${pet.name}: ${pet.medication}`, detail: `${pet.dosage || ''} om ${pet.medicationTime}` }] : []),
    ...(String(pet.vetAppointment || '').slice(0, 10) === today ? [{ id: pet.id, title: `${pet.name}: dierenarts`, detail: new Date(pet.vetAppointment).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) }] : [])
  ]);
  const weekday = String(now.getDay());
  const defaultCards = settings.dailyOverviewCards || ['appointments','departure','packing','tasks','shopping','birthdays','pets','waste','inventory','notices','routines','subscriptions','loans'];
  const activeMode = familyModes.find((item) => item.active);
  const configuredCards = cardKeys(activeMode?.visibleCards || []);
  const recognizedCards = configuredCards.filter((item) => defaultCards.includes(item));
  const hiddenCards = new Set(cardKeys(activeMode?.hiddenInformation || []));
  const visibleCards = (recognizedCards.length ? recognizedCards : defaultCards).filter((item) => !hiddenCards.has(item));
  const activeRoutineIds = new Set(activeMode?.activeRoutineIds || []);
  return {
    today, visibleCards, activeMode,
    appointments: ordinaryAppointments,
    departure: ordinaryAppointments.filter((item) => item.plannedDepartureTime || item.travelMinutes),
    packing: packing.filter((item) => item.status !== 'archived' && (item.date === today || ordinaryAppointments.some((appointment) => appointment.id === item.appointmentId))),
    tasks: urgentTasks,
    shopping: shopping.filter((item) => !item.checked),
    birthdays,
    pets: petAlerts,
    waste: waste.filter((item) => item.date === today || (daysUntil(item.date, today) === 1 && !item.putOutside)),
    inventory: lowOrExpiring,
    notices: notices.filter((item) => item.status !== 'archived' && (!item.expiryDate || item.expiryDate >= today) && (item.important || item.pinned)),
    routines: routines.filter((item) => !item.paused && item.status === 'active' && (item.days || []).includes(weekday) && (!activeRoutineIds.size || activeRoutineIds.has(item.id))),
    subscriptions: subscriptions.filter((item) => item.status === 'active' && (daysUntil(item.contractEndDate, today) <= 30 || daysUntil(item.trialEndDate, today) <= 7 || Number(item.debitDay) === now.getDate())),
    loans: loans.filter((item) => item.status !== 'returned' && daysUntil(item.expectedReturnDate, today) <= 0)
  };
}

export function inventoryUrgency(item, today = toDateKey()) {
  const expiryDays = daysUntil(item.expiryDate, today);
  if (expiryDays < 0) return 'Over datum';
  if (expiryDays <= 3) return expiryDays === 0 ? 'Vandaag opmaken' : `Nog ${expiryDays} dag${expiryDays === 1 ? '' : 'en'}`;
  return Number(item.quantity) <= Number(item.minimumQuantity) ? 'Lage voorraad' : '';
}
