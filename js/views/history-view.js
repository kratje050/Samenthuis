import { repositories } from '../state.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { e, emptyState, handleError } from './view-helpers.js';

const existingRepositories = { appointment: 'appointments', shopping: 'shopping', task: 'tasks', meal: 'meals', inventory: 'inventory', expense: 'expenses', pet: 'pets', outing: 'outings', settings: 'settings', template: 'templates' };

function sourceRepository(entity) { return repositories.modules?.[entity] || repositories[existingRepositories[entity]] || null; }

function snapshotTitle(history) {
  const record = history.snapshot || {};
  return record.title || record.name || record.productName || record.item || record.idea || history.recordId;
}

export const historyView = {
  async render() {
    const histories = (await repositories.history.getAll()).sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt))).slice(0, 250);
    return `<section class="page-stack history-page"><div class="page-header"><div><p class="eyebrow">Herstel</p><h2>Versiegeschiedenis</h2><p class="muted">Maximaal tien vorige versies per belangrijk record worden bewaard.</p></div><span class="badge">${histories.length} versie${histories.length === 1 ? '' : 's'}</span></div>${histories.length ? `<ul class="item-list">${histories.map((item) => `<li class="list-item"><div class="list-item-main"><span class="badge">${e(item.sourceEntity)}</span><strong>${e(snapshotTitle(item))}</strong><span class="small muted">Versie ${e(item.sourceVersion)} · ${e(new Date(item.changedAt).toLocaleString('nl-NL',{dateStyle:'medium',timeStyle:'short'}))} · ${e(item.changedByName || item.changedBy || 'Onbekend')}</span></div><button class="button secondary small" data-restore-version="${e(item.id)}">Deze versie herstellen</button></li>`).join('')}</ul>` : emptyState('Nog geen vorige versies', 'Na het aanpassen of verwijderen van gegevens verschijnen eerdere versies hier.')}</section>`;
  },
  async mount(root) {
    root.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-restore-version]'); if (!button) return;
      try {
        const history = await repositories.history.getById(button.dataset.restoreVersion); const repository = sourceRepository(history.sourceEntity);
        if (!repository) throw new Error('Het oorspronkelijke onderdeel bestaat niet meer.');
        if (!await confirmDialog({ title: 'Vorige versie herstellen?', message: 'De huidige versie blijft eerst zelf in de geschiedenis bewaard.', confirmLabel: 'Versie herstellen' })) return;
        const changes = { ...history.snapshot, deletedAt: null };
        ['id','createdAt','version','updatedAt','deviceId','syncStatus','conflictData'].forEach((key) => delete changes[key]);
        await repository.update(history.recordId, changes); showToast('Vorige versie hersteld.'); root.innerHTML = await historyView.render();
      } catch (error) { handleError(error); }
    });
  }
};
