import { BaseRepository } from './base-repository.js';

export class ActivityRepository extends BaseRepository {
  constructor() { super('activity', 'activity', { history: false, activity: false }); }
  async recent(limit = 100) {
    return (await this.getAll()).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, limit);
  }
}
