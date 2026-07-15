import { daysBetween, fromDateKey } from '../utils/dates.js';

export function getInventoryWarning(item, now = new Date()) {
  const messages = [];
  let severity = '';
  if (Number(item.quantity) <= Number(item.minimumQuantity)) { messages.push('Lage voorraad'); severity = 'urgent'; }
  if (item.expiryDate) {
    const days = daysBetween(now, fromDateKey(item.expiryDate));
    if (days < 0) { messages.push('Over datum'); severity = 'expired'; }
    else if (days <= 3) { messages.push(days === 0 ? 'Vandaag houdbaar' : `Nog ${days} dagen`); if (!severity) severity = 'high'; }
  }
  return { messages, severity };
}
