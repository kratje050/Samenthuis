const configurations = {
  appointments: { type: 'Afspraak', title: (r) => r.title },
  shopping: { type: 'Boodschap', title: (r) => r.productName },
  tasks: { type: 'Taak', title: (r) => r.title },
  meals: { type: 'Maaltijd of recept', title: (r) => r.name },
  inventory: { type: 'Voorraadproduct', title: (r) => r.productName },
  expenses: { type: 'Uitgave', title: (r) => r.description },
  pets: { type: 'Huisdier', title: (r) => r.name },
  outings: { type: 'Uitje', title: (r) => r.name }
};

export class TrashService {
  constructor(repositories) { this.repositories = repositories; }

  async getDeletedItems() {
    const groups = await Promise.all(Object.entries(configurations).map(async ([entity, config]) => {
      const records = await this.repositories[entity].getAll({ includeDeleted: true });
      return records.filter((record) => record.deletedAt).map((record) => ({
        id: record.id, entity, type: config.type, title: config.title(record) || config.type,
        deletedAt: record.deletedAt
      }));
    }));
    return groups.flat().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async restore(entity, id) {
    if (!configurations[entity] || !this.repositories[entity]) throw new Error('Dit type item kan niet worden hersteld.');
    return this.repositories[entity].restore(id);
  }
}
