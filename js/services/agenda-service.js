import { expandAppointment } from './recurrence-service.js';
import { dateTimeForRecord } from '../utils/dates.js';

export class AgendaService {
  constructor(repository) { this.repository = repository; }

  async occurrencesBetween(start, end, filters = {}) {
    const records = await this.repository.getAll();
    const query = String(filters.query || '').trim().toLocaleLowerCase('nl-NL');
    return records.flatMap((record) => expandAppointment(record, start, end)).filter((item) => {
      if (filters.member && !(item.members || []).includes(filters.member)) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (query) {
        const haystack = [item.title, item.location, item.category, item.notes, item.description, ...(item.memberNames || [])].join(' ').toLocaleLowerCase('nl-NL');
        if (!haystack.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => dateTimeForRecord(a, a.occurrenceDate) - dateTimeForRecord(b, b.occurrenceDate));
  }
}
