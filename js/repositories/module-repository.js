import { BaseRepository } from './base-repository.js';
import { ASSISTANT_ENTITY_TYPES, STORES } from '../config.js';

export class ModuleRepository extends BaseRepository {
  constructor(module) {
    if (!ASSISTANT_ENTITY_TYPES.includes(module)) throw new Error(`Onbekende gezinsmodule: ${module}`);
    super(STORES.assistant, module);
    this.module = module;
  }

  async getAll(options = {}) {
    return (await super.getAll(options)).filter((record) => record.module === this.module);
  }

  async getById(id, options = {}) {
    const record = await super.getById(id, options);
    return record?.module === this.module ? record : null;
  }

  create(data, updatedBy = 'device') {
    return super.create({ ...data, module: this.module }, updatedBy);
  }

  update(id, changes, updatedBy = 'device') {
    return super.update(id, { ...changes, module: this.module }, updatedBy);
  }
}
