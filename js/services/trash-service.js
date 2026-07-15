import { ASSISTANT_MODULES } from '../modules/assistant-modules.js';

const configurations = {
  appointments: { type: 'Afspraak', title: (r) => r.title },
  shopping: { type: 'Boodschap', title: (r) => r.productName },
  tasks: { type: 'Taak', title: (r) => r.title },
  meals: { type: 'Maaltijd of recept', title: (r) => r.name },
  inventory: { type: 'Voorraadproduct', title: (r) => r.productName },
  expenses: { type: 'Uitgave', title: (r) => r.description },
  pets: { type: 'Huisdier', title: (r) => r.name },
  outings: { type: 'Uitje', title: (r) => r.name },
  templates: { type: 'Sjabloon', title: (r) => r.title }
};

export class TrashService {
  constructor(repositories, fileService = null) { this.repositories = repositories; this.fileService = fileService; }

  async getDeletedItems() {
    const available = Object.entries(configurations).filter(([entity]) => this.repositories[entity]);
    const groups = await Promise.all(available.map(async ([entity, config]) => {
      const records = await this.repositories[entity].getAll({ includeDeleted: true });
      return records.filter((record) => record.deletedAt && !record.purgedAt).map((record) => ({
        id: record.id, entity, type: config.type, title: config.title(record) || config.type,
        deletedAt: record.deletedAt
      }));
    }));
    const moduleGroups = await Promise.all(Object.entries(ASSISTANT_MODULES).map(async ([module, definition]) => {
      const records = await this.repositories.modules?.[module]?.getAll({ includeDeleted: true }) || [];
      return records.filter((record) => record.deletedAt && !record.purgedAt).map((record) => ({
        id: record.id, entity: `module:${module}`, type: definition.singular,
        title: record[definition.titleField] || definition.singular, deletedAt: record.deletedAt
      }));
    }));
    return [...groups, ...moduleGroups].flat().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async restore(entity, id) {
    if (entity.startsWith('module:')) {
      const module = entity.slice(7);
      if (!this.repositories.modules?.[module]) throw new Error('Dit type item kan niet worden hersteld.');
      return this.repositories.modules[module].restore(id);
    }
    if (!configurations[entity] || !this.repositories[entity]) throw new Error('Dit type item kan niet worden hersteld.');
    return this.repositories[entity].restore(id);
  }

  repository(entity) {
    if (entity.startsWith('module:')) return this.repositories.modules?.[entity.slice(7)] || null;
    return configurations[entity] ? this.repositories[entity] : null;
  }

  async purge(entity, id) {
    const repository = this.repository(entity);
    if (!repository) throw new Error('Dit type item kan niet definitief worden verwijderd.');
    const record = await repository.getById(id, { includeDeleted: true });
    const fileIds = record ? Object.entries(record)
      .filter(([key, value]) => /FileId$/.test(key) && typeof value === 'string' && value)
      .map(([, value]) => value) : [];
    const result = await repository.purge(id);
    for (const fileId of fileIds) await this.fileService?.remove(fileId);
    return result;
  }

  async purgeExpired(days) {
    if (!Number(days)) return 0;
    const threshold = Date.now() - Number(days) * 86400000;
    const items = (await this.getDeletedItems()).filter((item) => new Date(item.deletedAt).getTime() <= threshold);
    for (const item of items) await this.purge(item.entity, item.id);
    return items.length;
  }
}
