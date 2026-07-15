import { BaseRepository } from './base-repository.js';
import { STORES } from '../config.js';

export class HistoryRepository extends BaseRepository {
  constructor() { super(STORES.history, 'history', { history: false, activity: false }); }

  async forRecord(sourceEntity, recordId) {
    return (await this.getAll()).filter((item) => item.sourceEntity === sourceEntity && item.recordId === recordId)
      .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));
  }
}
