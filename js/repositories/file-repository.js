import { BaseRepository } from './base-repository.js';
import { STORES } from '../config.js';

export class FileRepository extends BaseRepository {
  constructor() { super(STORES.files, 'file', { history: false, activity: false }); }

  async forRecord(entityType, recordId) {
    return (await this.getAll()).filter((item) => item.entityType === entityType && item.recordId === recordId);
  }
}
