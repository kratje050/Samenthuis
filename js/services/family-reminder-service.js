import { fromDateKey, toDateKey } from '../utils/dates.js';

function at(date, time = '09:00') { return date ? fromDateKey(String(date).slice(0, 10), time || '09:00') : null; }
function atDateTime(value) { const [date, time = '09:00'] = String(value || '').split('T'); return at(date, time.slice(0, 5)); }
function addAlert(alerts, record, type, due, title, message, route) {
  if (due && !Number.isNaN(due.getTime())) alerts.push({ key: `${type}:${record.id}:${due.toISOString()}`, due, title, message, route });
}

export async function collectFamilyReminders(repositories, now = new Date()) {
  const today = toDateKey(now);
  const weekday = String(now.getDay());
  const all = (repository) => repository?.getAll?.() || Promise.resolve([]);
  const modules = repositories?.modules || {};
  const [tasks, pets, inventory, outings, waste, loans, maintenance, appliances, subscriptions, routines, bucket, babysitting, packing] = await Promise.all([
    all(repositories?.tasks), all(repositories?.pets), all(repositories?.inventory), all(repositories?.outings),
    all(modules.waste), all(modules.loan), all(modules.maintenance), all(modules.appliance), all(modules.subscription),
    all(modules.routine), all(modules.bucket_list), all(modules.babysitting), all(modules.packing)
  ]);
  const alerts = [];
  tasks.filter((item) => !item.reminderDisabled && !['done','completed','archived'].includes(item.status)).forEach((item) => addAlert(alerts, item, 'task', at(item.date, item.time || '09:00'), `Taak: ${item.title}`, item.priority ? `Prioriteit: ${item.priority}` : 'Deze taak staat gepland', '#tasks'));
  pets.forEach((item) => {
    if (item.medication && item.medicationTime) addAlert(alerts, item, 'pet-medication', at(today, item.medicationTime), `Medicatie voor ${item.name}`, `${item.medication}${item.dosage ? ` · ${item.dosage}` : ''}`, '#pets');
    if (item.vetAppointment) {
      const visit = atDateTime(item.vetAppointment);
      if (visit) {
        const dayBefore = new Date(visit); dayBefore.setDate(dayBefore.getDate() - 1);
        const hourBefore = new Date(visit); hourBefore.setHours(hourBefore.getHours() - 1);
        addAlert(alerts, item, 'pet-vet-day', dayBefore, `Morgen naar de dierenarts: ${item.name}`, item.vet || 'Controleer tijd en benodigdheden', '#pets');
        addAlert(alerts, item, 'pet-vet-hour', hourBefore, `Over een uur naar de dierenarts: ${item.name}`, item.vet || 'De afspraak komt eraan', '#pets');
      }
    }
  });
  inventory.forEach((item) => {
    if (Number(item.quantity) <= Number(item.minimumQuantity)) addAlert(alerts, item, 'inventory-low', at(today), `Lage voorraad: ${item.productName}`, `Nog ${item.quantity ?? 0} ${item.unit || ''} beschikbaar`, '#inventory');
    if (item.expiryDate) {
      const expiry = at(item.expiryDate); const days = expiry ? Math.round((expiry - at(today)) / 86400000) : null;
      if (days === 3) addAlert(alerts, item, 'inventory-expiry-soon', at(today), `Bijna over datum: ${item.productName}`, 'Nog 3 dagen houdbaar', '#inventory');
      if (days === 0) addAlert(alerts, item, 'inventory-expiry-today', at(today), `Vandaag houdbaar: ${item.productName}`, 'Gebruik dit product vandaag', '#inventory');
    }
  });
  outings.filter((item) => item.planned && !item.completed).forEach((item) => { const due = at(item.date); if (due) due.setDate(due.getDate() - 1); addAlert(alerts, item, 'outing', due, `Morgen: ${item.name}`, item.location || 'Controleer de planning', '#outings'); });
  waste.filter((item) => !item.putOutside).forEach((item) => {
    const pickup = at(item.date, item.reminderTime || '20:00');
    if (pickup) pickup.setDate(pickup.getDate() - 1);
    addAlert(alerts, item, 'waste', pickup, `${item.wasteType} buitenzetten`, `Ophaaldag ${item.date}`, '#assistant?module=waste');
  });
  loans.filter((item) => item.status !== 'returned').forEach((item) => addAlert(alerts, item, 'loan', at(item.reminder || item.expectedReturnDate), `${item.item} terugbrengen`, item.person || '', '#assistant?module=loan'));
  maintenance.filter((item) => !['done','archived'].includes(item.status)).forEach((item) => addAlert(alerts, item, 'maintenance', at(item.nextDate), item.title, 'Onderhoud staat gepland', '#assistant?module=maintenance'));
  appliances.filter((item) => item.status === 'active' && item.warrantyExpiry).forEach((item) => {
    const due = at(item.warrantyExpiry); if (due) due.setDate(due.getDate() - 30);
    addAlert(alerts, item, 'warranty', due, `Garantie ${item.name}`, `Verloopt op ${item.warrantyExpiry}`, '#assistant?module=appliance');
  });
  subscriptions.filter((item) => item.status === 'active').forEach((item) => {
    addAlert(alerts, item, 'trial', at(item.trialEndDate), `Proefperiode ${item.name}`, 'Controleer of je wilt opzeggen', '#assistant?module=subscription');
    addAlert(alerts, item, 'contract', at(item.contractEndDate), `Contract ${item.name}`, 'Contracteinddatum bereikt', '#assistant?module=subscription');
    if (Number(item.debitDay) === now.getDate()) addAlert(alerts, item, 'debit', at(today), `Incasso ${item.name}`, 'Vandaag staat een betaling gepland', '#assistant?module=subscription');
  });
  routines.filter((item) => !item.reminderDisabled && item.status === 'active' && !item.paused && (item.days || []).includes(weekday)).forEach((item) => addAlert(alerts, item, 'routine', at(today, item.startTime || '09:00'), item.title, 'De routine staat klaar', '#routines'));
  bucket.filter((item) => !item.completed).forEach((item) => addAlert(alerts, item, 'bucket', at(item.reminder), item.activity, 'Herinnering uit de gezinsbucketlist', '#assistant?module=bucket_list'));
  babysitting.forEach((item) => { const due = atDateTime(item.startAt); if (due) due.setHours(due.getHours() - 1); addAlert(alerts, item, 'babysitting', due, `Oppasmoment over een uur: ${item.title}`, 'Controleer instructies en contactgegevens', '#babysitter'); });
  packing.forEach((item) => { const list = Array.isArray(item.items) ? item.items : []; const complete = list.length && list.every((entry) => typeof entry === 'object' && (entry.checked || entry.completed || entry.done)); if (!complete) addAlert(alerts, item, 'packing', at(item.date, '08:00'), `Meeneemlijst: ${item.title}`, 'De lijst is nog niet volledig afgevinkt', '#packing'); });
  return alerts.sort((a, b) => a.due - b.due);
}
