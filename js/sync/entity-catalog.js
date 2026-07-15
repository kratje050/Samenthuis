(function registerSamenThuisEntityCatalog(scope) {
  const definitions = {
    appointment: 'appointments', shopping: 'shopping', task: 'tasks', meal: 'meals',
    inventory: 'inventory', expense: 'expenses', pet: 'pets', outing: 'outings',
    settings: 'settings', activity: 'activity', template: 'templates', history: 'recordHistory',
    file: 'files', notice: 'assistantRecords', inbox: 'assistantRecords', packing: 'assistantRecords',
    child: 'assistantRecords', routine: 'assistantRecords', family_mode: 'assistantRecords',
    maintenance: 'assistantRecords', appliance: 'assistantRecords', storage_location: 'assistantRecords',
    loan: 'assistantRecords', gift: 'assistantRecords', waste: 'assistantRecords',
    babysitting: 'assistantRecords', emergency: 'assistantRecords', subscription: 'assistantRecords',
    savings_goal: 'assistantRecords', price_history: 'assistantRecords', visit_plan: 'assistantRecords',
    decision_wheel: 'assistantRecords', reward: 'assistantRecords', family_memory: 'assistantRecords',
    bucket_list: 'assistantRecords', home_project: 'assistantRecords'
  };
  const aliases = {};
  Object.entries(definitions).forEach(([entity, store]) => {
    aliases[entity] = entity;
    if (!entity.endsWith('s')) aliases[`${entity}s`] = entity;
    if (store !== 'assistantRecords') aliases[store] = entity;
  });
  aliases.appointments = 'appointment'; aliases.tasks = 'task'; aliases.meals = 'meal';
  aliases.expenses = 'expense'; aliases.pets = 'pet'; aliases.outings = 'outing';
  aliases.activities = 'activity'; aliases.templates = 'template';
  scope.SAMEN_THUIS_ENTITY_CATALOG = Object.freeze({ definitions: Object.freeze(definitions), aliases: Object.freeze(aliases) });
})(globalThis);
