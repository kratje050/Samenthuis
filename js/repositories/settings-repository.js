import { BaseRepository } from './base-repository.js';
import { SETTINGS_ID } from '../config.js';
export class SettingsRepository extends BaseRepository {
  constructor() { super('settings', 'settings'); }
  get() { return this.getById(SETTINGS_ID); }
  async save(changes, updatedBy = 'device') { return this.update(SETTINGS_ID, changes, updatedBy); }
}
