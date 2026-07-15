import { fromDateKey, toDateKey } from '../utils/dates.js';

function at(date, time = '09:00') { return date ? fromDateKey(String(date).slice(0, 10), time || '09:00') : null; }
function addAlert(alerts, record, type, due, title, message, route) {
  if (due && !Number.isNaN(due.getTime())) alerts.push({ key: `${type}:${record.id}:${due.toISOString()}`, due, title, message, route });
}

export async function collectFamilyReminders(repositories, now = new Date()) {
  if (!repositories?.modules) return [];
  const today = toDateKey(now);
  const weekday = String(now.getDay());
  const [waste, loans, maintenance, appliances, subscriptions, routines, bucket] = await Promise.all([
    repositories.modules.waste.getAll(), repositories.modules.loan.getAll(), repositories.modules.maintenance.getAll(),
    repositories.modules.appliance.getAll(), repositories.modules.subscription.getAll(), repositories.modules.routine.getAll(),
    repositories.modules.bucket_list.getAll()
  ]);
  const alerts = [];
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
  routines.filter((item) => item.status === 'active' && !item.paused && (item.days || []).includes(weekday)).forEach((item) => addAlert(alerts, item, 'routine', at(today, item.startTime || '09:00'), item.title, 'De routine staat klaar', '#routines'));
  bucket.filter((item) => !item.completed).forEach((item) => addAlert(alerts, item, 'bucket', at(item.reminder), item.activity, 'Herinnering uit de gezinsbucketlist', '#assistant?module=bucket_list'));
  return alerts.sort((a, b) => a.due - b.due);
}
