import { BaseRepository } from './base-repository.js';
import { withAutomaticTaskPoints } from '../services/points-service.js';

export class TaskRepository extends BaseRepository {
  constructor() { super('tasks', 'task'); }

  create(data, updatedBy) {
    return super.create(withAutomaticTaskPoints(data), updatedBy);
  }

  async update(id, changes, updatedBy) {
    const current = await this.getById(id);
    if (!current) throw new Error('Taak niet gevonden.');
    return super.update(id, withAutomaticTaskPoints({ ...current, ...changes }), updatedBy);
  }
}
