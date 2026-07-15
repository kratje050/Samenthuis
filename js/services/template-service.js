import { toDateKey } from '../utils/dates.js';

export const TEMPLATE_TYPES = Object.freeze({ shopping: 'Boodschappenlijst', tasks: 'Takenlijst', packing: 'Inpaklijst' });

export function linesToTemplateItems(lines = '') {
  return [...new Set(String(lines).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].map((name) => ({ name }));
}

export async function applyTemplate(template, repositories) {
  if (!template?.items?.length) throw new Error('Dit sjabloon bevat geen regels.');
  let created = 0;
  if (template.templateType === 'shopping') {
    for (const item of template.items) {
      await repositories.shopping.create({ productName: item.name, quantity: 1, unit: 'stuks', category: 'Overig', store: '', note: `Uit sjabloon ${template.title}`, addedBy: 'device', checked: false, checkedAt: null, checkedBy: null });
      created += 1;
    }
  } else if (template.templateType === 'packing' && repositories.modules?.packing) {
    await repositories.modules.packing.create({
      title: template.title, packingType: 'Eigen sjabloon', date: '', appointmentId: '', categories: ['Algemeen'],
      items: template.items.map((item) => ({ id: crypto.randomUUID(), text: item.name, quantity: 1, category: 'Algemeen', memberId: '', essential: false, done: false, note: '' })),
      notes: template.notes || '', essentialOnly: false, status: 'active'
    });
    created = template.items.length;
  } else {
    for (const item of template.items) {
      await repositories.tasks.create({
        title: item.name, description: '', assignedTo: '', date: toDateKey(), time: '', priority: 'normal',
        category: 'Huishouden', recurrence: 'none',
        status: 'open', notes: `Uit sjabloon ${template.title}`
      });
      created += 1;
    }
  }
  return created;
}
