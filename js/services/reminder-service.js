import { dateTimeForRecord, toDateKey } from '../utils/dates.js';
import { showNotification } from './notification-service.js';

const shown = new Set();
const reminderMinutes = { at_time: 0, min15: 15, min30: 30, hour1: 60, day1: 1440 };

export class ReminderService {
  constructor(agendaService, onInAppReminder) {
    this.agendaService = agendaService;
    this.onInAppReminder = onInAppReminder;
  }

  start() {
    this.stop();
    this.check();
    this.timer = setInterval(() => this.check(), 60000);
  }
  stop() { if (this.timer) clearInterval(this.timer); }

  async check() {
    const now = new Date();
    const records = await this.agendaService.repository.getAll();
    const largestReminder = records.reduce((largest, item) => {
      const minutes = item.reminder === 'custom' ? Number(item.reminderCustom || 0) : reminderMinutes[item.reminder] || 0;
      return Math.max(largest, minutes);
    }, 1440);
    const horizon = new Date(now.getTime() + (largestReminder + 1440) * 60000);
    const occurrences = await this.agendaService.occurrencesBetween(now, horizon);
    for (const item of occurrences) {
      if (!item.reminder || item.reminder === 'none' || item.completed) continue;
      const minutes = item.reminder === 'custom' ? Number(item.reminderCustom || 0) : reminderMinutes[item.reminder] || 0;
      const due = new Date(dateTimeForRecord(item, item.occurrenceDate).getTime() - minutes * 60000);
      const key = `${item.occurrenceId}:${minutes}`;
      if (due <= now && now - due < 86400000 && !shown.has(key)) {
        shown.add(key);
        const message = `${item.allDay ? 'Vandaag' : item.startTime || ''}${item.location ? ` · ${item.location}` : ''}`;
        const notified = await showNotification(item.title, { body: message, tag: key, data: { route: '#agenda' } });
        if (!notified) this.onInAppReminder?.({ title: item.title, message });
      }
    }
    sessionStorage.setItem('samen-thuis-reminder-check', toDateKey(now));
  }
}
