const metadata = new Set(['syncStatus','conflictData','updatedAt','updatedBy','deviceId','version']);

export function conflictFields(conflictData) {
  const local = conflictData?.local || {};
  const remote = conflictData?.remote || {};
  return [...new Set([...Object.keys(local), ...Object.keys(remote)])].filter((key) => !metadata.has(key) && JSON.stringify(local[key]) !== JSON.stringify(remote[key])).map((key) => ({ key, local: local[key], remote: remote[key] }));
}

export function mergeConflict(conflictData, choices = {}) {
  const local = conflictData?.local || {};
  const remote = conflictData?.remote || {};
  const merged = { ...remote };
  conflictFields(conflictData).forEach(({ key }) => { merged[key] = choices[key] === 'local' ? local[key] : remote[key]; });
  ['id','createdAt','createdBy'].forEach((key) => { if (local[key] !== undefined) merged[key] = local[key]; });
  delete merged.conflictData;
  delete merged.syncStatus;
  return merged;
}

export async function findConflicts(repositories) {
  const entries = [
    ['appointment', repositories.appointments], ['shopping', repositories.shopping], ['task', repositories.tasks], ['meal', repositories.meals],
    ['inventory', repositories.inventory], ['expense', repositories.expenses], ['pet', repositories.pets], ['outing', repositories.outings],
    ['settings', repositories.settings], ['template', repositories.templates], ...Object.entries(repositories.modules || {})
  ];
  const groups = await Promise.all(entries.map(async ([entity, repository]) => (await repository.getAll({ includeDeleted: true })).filter((record) => record.syncStatus === 'conflict' && record.conflictData).map((record) => ({ entity, repository, record }))));
  return groups.flat();
}

export async function resolveConflict({ repository, record, choice, fieldChoices = {} }) {
  if (choice === 'remote') return repository.markSynced(record.id, { ...record.conflictData.remote, conflictData: null }, { conflict: false });
  const changes = choice === 'local' ? { ...record.conflictData.local } : mergeConflict(record.conflictData, fieldChoices);
  ['id','createdAt','version','updatedAt','deviceId','syncStatus'].forEach((key) => delete changes[key]);
  return repository.update(record.id, { ...changes, conflictData: null });
}
