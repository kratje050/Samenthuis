const configurations = [
  { key: 'appointments', type: 'Afspraak', route: 'agenda', title: (r) => r.title, fields: ['title', 'description', 'location', 'category', 'notes', 'memberNames'], detail: (r) => [r.date, r.location].filter(Boolean).join(' · ') },
  { key: 'shopping', type: 'Boodschap', route: 'shopping', title: (r) => r.productName, fields: ['productName', 'category', 'store', 'note'], detail: (r) => [r.quantity, r.unit, r.category].filter(Boolean).join(' ') },
  { key: 'tasks', type: 'Taak', route: 'tasks', title: (r) => r.title, fields: ['title', 'description', 'category', 'note'], detail: (r) => [r.date, r.category].filter(Boolean).join(' · ') },
  { key: 'meals', type: 'Maaltijd of recept', route: 'meals', title: (r) => r.name, fields: ['name', 'ingredients', 'instructions', 'notes'], detail: (r) => r.kind === 'recipe' ? 'Recept' : [r.date, r.mealType].filter(Boolean).join(' · ') },
  { key: 'inventory', type: 'Voorraad', route: 'inventory', title: (r) => r.productName, fields: ['productName', 'category', 'storageLocation', 'notes'], detail: (r) => [r.quantity, r.unit, r.storageLocation].filter(Boolean).join(' ') },
  { key: 'expenses', type: 'Uitgave', route: 'expenses', title: (r) => r.description, fields: ['description', 'category', 'paymentMethod', 'note'], detail: (r) => [r.date, r.category].filter(Boolean).join(' · ') },
  { key: 'pets', type: 'Huisdier', route: 'pets', title: (r) => r.name, fields: ['name', 'species', 'breed', 'vet', 'medication', 'appointments', 'vaccinations', 'notes'], detail: (r) => [r.species, r.breed].filter(Boolean).join(' · ') },
  { key: 'outings', type: 'Uitje', route: 'outings', title: (r) => r.name, fields: ['name', 'location', 'category', 'notes'], detail: (r) => [r.date, r.location].filter(Boolean).join(' · ') }
];

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL');
}

export class SearchService {
  constructor(repositories) { this.repositories = repositories; }

  async search(query, limit = 40) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const groups = await Promise.all(configurations.map(async (config) => {
      const records = await this.repositories[config.key].getAll();
      return records.filter((record) => {
        const haystack = normalize(config.fields.flatMap((field) => record[field] ?? []).join(' '));
        return terms.every((term) => haystack.includes(term));
      }).map((record) => ({
        id: record.id, entity: config.key, type: config.type, route: config.route,
        title: config.title(record) || config.type, detail: config.detail(record),
        score: normalize(config.title(record)).startsWith(terms[0]) ? 0 : 1,
        updatedAt: record.updatedAt || ''
      }));
    }));
    return groups.flat().sort((a, b) => a.score - b.score || b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title, 'nl')).slice(0, limit);
  }
}
