import { toDateKey } from '../utils/dates.js';

function sourceTitle(record) { return record.title || record.idea || record.activity || record.item || record.name || record.content || 'Nieuw item'; }

export async function convertAssistantRecord({ module, record, target, repositories }) {
  const existingId = record.convertedRecords?.[target] || (target === 'outing' ? record.outingId : null);
  const targetRepository = target === 'notice' || target === 'gift' ? repositories.modules[target] : target === 'child_note' ? repositories.modules.child : target === 'recipe' ? repositories.meals : repositories[`${target}s`] || repositories[target];
  if (!targetRepository) throw new Error('Dit onderdeel kan niet worden aangemaakt.');
  if (existingId && await targetRepository.getById(existingId, { includeDeleted: true })) return { id: existingId, duplicate: true };

  const title = sourceTitle(record);
  let created;
  if (target === 'child_note') {
    const profiles = await repositories.modules.child.getAll();
    const profile = profiles.find((item) => (record.memberIds || []).includes(item.memberId));
    if (!profile) throw new Error('Koppel het inbox-item aan een gezinslid met een kindprofiel.');
    const note = [record.content || record.notes || '', record.link || ''].filter(Boolean).join(' · ');
    created = await repositories.modules.child.update(profile.id, { notes: [profile.notes, `${title}: ${note}`].filter(Boolean).join('\n') });
  } else if (target === 'appointment') created = await repositories.appointments.create({
    title, description: record.content || record.message || record.notes || '', date: record.date || toDateKey(),
    allDay: true, startTime: '', endTime: '', location: record.location || '', category: 'Gezin', members: record.memberIds || [],
    recurrence: 'none', recurrenceInterval: 1, recurrenceUnit: 'day', recurrenceEndDate: null,
    reminder: 'none', reminderCustomMinutes: 0, notes: `Aangemaakt vanuit ${module}`, completed: false
  });
  else if (target === 'task') created = await repositories.tasks.create({
    title, description: record.content || record.message || '', assignedTo: record.memberIds?.[0] || '', date: record.date || toDateKey(),
    time: '', priority: record.important ? 'high' : 'normal', category: 'Gezin', recurrence: 'none', status: 'open', notes: `Aangemaakt vanuit ${module}`
  });
  else if (target === 'shopping') created = await repositories.shopping.create({
    productName: title, quantity: 1, unit: 'stuks', category: 'Overig', store: '', note: record.content || record.message || `Aangemaakt vanuit ${module}`,
    addedBy: 'device', checked: false, checkedAt: null, checkedBy: null, favorite: false
  });
  else if (target === 'outing') created = await repositories.outings.create({
    name: title, location: record.location || '', date: record.date || null, estimatedPrice: Number(record.estimatedCost || record.price || 0),
    website: record.link || '', travelTime: '', category: 'Overig', notes: record.content || record.notes || '', favorite: Boolean(record.favorite), planned: true, completed: false
  });
  else if (target === 'notice') created = await repositories.modules.notice.create({
    title, message: record.content || record.notes || '', memberIds: record.memberIds || [], important: false, pinned: false,
    readBy: [], expiryDate: '', link: record.link || '', imageFileId: record.imageFileId || null, status: 'active', sortPosition: 0
  });
  else if (target === 'gift') created = await repositories.modules.gift.create({
    recipient: '', idea: title, occasion: '', date: '', price: 0, budget: 0, store: '', link: record.link || '', imageFileId: record.imageFileId || null,
    purchased: false, wrapped: false, given: false, hiddenForUserIds: [], notes: record.content || '', status: 'active'
  });
  else if (target === 'recipe') created = await repositories.meals.create({
    kind: 'recipe', name: title, ingredients: record.content || '', instructions: record.notes || '', favorite: false, notes: `Aangemaakt vanuit ${module}`
  });
  else throw new Error('Deze omzetting wordt niet ondersteund.');

  const convertedRecords = { ...(record.convertedRecords || {}), [target]: created.id };
  const changes = { convertedRecords };
  if (module === 'inbox') Object.assign(changes, { processed: true, status: 'archived' });
  if (module === 'bucket_list' && target === 'outing') changes.outingId = created.id;
  await repositories.modules[module].update(record.id, changes);
  return { id: created.id, duplicate: false };
}
