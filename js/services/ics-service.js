function escapeIcs(value = '') { return String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function unescapeIcs(value = '') { return String(value).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }
function compactDate(value = '') { return String(value).replaceAll('-', ''); }
function compactDateTime(date, time = '00:00') { return `${compactDate(date)}T${String(time).replace(':', '').padEnd(6, '0')}`; }
function icsTimestamp(date = new Date()) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }

function recurrenceRule(item) {
  const rules = {
    daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY',
    biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY'
  };
  let rule = rules[item.recurrence] || '';
  if (item.recurrence === 'custom') {
    const frequency = { days: 'DAILY', weeks: 'WEEKLY', months: 'MONTHLY' }[item.recurrenceUnit] || 'DAILY';
    rule = `FREQ=${frequency};INTERVAL=${Math.max(1, Number(item.recurrenceInterval || 1))}`;
  }
  if (rule && item.recurrenceUntil) rule += `;UNTIL=${compactDate(item.recurrenceUntil)}T235959`;
  return rule;
}

function reminderTrigger(item) {
  const values = { at_time: 'PT0M', min15: '-PT15M', min30: '-PT30M', hour1: '-PT1H', day1: '-P1D' };
  if (item.reminder === 'custom') return `-PT${Math.max(0, Number(item.reminderCustom || 0))}M`;
  return values[item.reminder] || '';
}

function foldLine(line) {
  const chunks = [];
  let rest = line;
  while (rest.length > 72) { chunks.push(rest.slice(0, 72)); rest = ` ${rest.slice(72)}`; }
  chunks.push(rest);
  return chunks.join('\r\n');
}

export function appointmentsToIcs(appointments, { calendarName = 'Samen Thuis', now = new Date() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Samen Thuis//Gezinsagenda//NL', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeIcs(calendarName)}`];
  for (const item of appointments.filter((record) => !record.deletedAt)) {
    lines.push('BEGIN:VEVENT', `UID:${escapeIcs(item.externalUid || `${item.id}@samen-thuis`)}`, `DTSTAMP:${icsTimestamp(now)}`);
    if (item.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(item.date)}`);
      if (item.endDate) lines.push(`DTEND;VALUE=DATE:${compactDate(item.endDate)}`);
    } else {
      lines.push(`DTSTART:${compactDateTime(item.date, item.startTime)}`);
      if (item.endTime) lines.push(`DTEND:${compactDateTime(item.date, item.endTime)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(item.title)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeIcs(item.description)}`);
    if (item.location) lines.push(`LOCATION:${escapeIcs(item.location)}`);
    if (item.category) lines.push(`CATEGORIES:${escapeIcs(item.category)}`);
    if (item.notes) lines.push(`X-SAMEN-THUIS-NOTES:${escapeIcs(item.notes)}`);
    if (item.members?.length) lines.push(`X-SAMEN-THUIS-MEMBER-IDS:${item.members.join(',')}`);
    const rule = recurrenceRule(item); if (rule) lines.push(`RRULE:${rule}`);
    const trigger = reminderTrigger(item);
    if (trigger) lines.push('BEGIN:VALARM', `TRIGGER:${trigger}`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(item.title)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

function parseDateValue(raw, key) {
  const value = raw.replace(/Z$/, '');
  const allDay = key.includes('VALUE=DATE') || /^\d{8}$/.test(value);
  const date = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  const time = allDay || value.length < 13 ? '' : `${value.slice(9,11)}:${value.slice(11,13)}`;
  return { date, time, allDay };
}

function parseRule(rule = '') {
  const values = Object.fromEntries(rule.split(';').map((part) => part.split('=')));
  let recurrence = 'none';
  if (values.FREQ === 'DAILY') recurrence = Number(values.INTERVAL || 1) === 1 ? 'daily' : 'custom';
  if (values.FREQ === 'WEEKLY' && values.BYDAY === 'MO,TU,WE,TH,FR') recurrence = 'weekdays';
  else if (values.FREQ === 'WEEKLY') recurrence = Number(values.INTERVAL || 1) === 2 ? 'biweekly' : Number(values.INTERVAL || 1) === 1 ? 'weekly' : 'custom';
  if (values.FREQ === 'MONTHLY') recurrence = Number(values.INTERVAL || 1) === 1 ? 'monthly' : 'custom';
  if (values.FREQ === 'YEARLY') recurrence = 'yearly';
  const recurrenceUnit = { DAILY: 'days', WEEKLY: 'weeks', MONTHLY: 'months' }[values.FREQ] || 'days';
  const until = values.UNTIL ? parseDateValue(values.UNTIL, 'UNTIL').date : null;
  return { recurrence, recurrenceInterval: Number(values.INTERVAL || 1), recurrenceUnit, recurrenceUntil: until };
}

export function icsToAppointments(content) {
  if (!/BEGIN:VCALENDAR/i.test(content) || !/END:VCALENDAR/i.test(content)) throw new Error('Dit bestand is geen geldige iCalendar-agenda.');
  const lines = String(content).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let current = null;
  let inAlarm = false;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; inAlarm = false; continue; }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; inAlarm = false; continue; }
    if (line === 'BEGIN:VALARM') { inAlarm = true; continue; }
    if (line === 'END:VALARM') { inAlarm = false; continue; }
    if (!current || inAlarm) continue;
    const colon = line.indexOf(':'); if (colon < 0) continue;
    const key = line.slice(0, colon).toUpperCase(); const value = line.slice(colon + 1);
    if (key.startsWith('DTSTART')) current.start = parseDateValue(value, key);
    else if (key.startsWith('DTEND')) current.end = parseDateValue(value, key);
    else if (key === 'SUMMARY') current.title = unescapeIcs(value);
    else if (key === 'DESCRIPTION') current.description = unescapeIcs(value);
    else if (key === 'LOCATION') current.location = unescapeIcs(value);
    else if (key === 'CATEGORIES') current.category = unescapeIcs(value.split(',')[0]);
    else if (key === 'UID') current.externalUid = unescapeIcs(value);
    else if (key === 'RRULE') current.rule = parseRule(value);
    else if (key === 'X-SAMEN-THUIS-NOTES') current.notes = unescapeIcs(value);
    else if (key === 'X-SAMEN-THUIS-MEMBER-IDS') current.members = value.split(',').filter(Boolean);
  }
  return events.filter((event) => event.start?.date && event.title).map((event) => ({
    title: event.title, description: event.description || '', date: event.start.date, allDay: event.start.allDay,
    startTime: event.start.time, endTime: event.end?.time || '', location: event.location || '', category: event.category || 'Overig',
    members: event.members || [], memberNames: [], recurrence: event.rule?.recurrence || 'none', recurrenceUntil: event.rule?.recurrenceUntil || null,
    recurrenceInterval: event.rule?.recurrenceInterval || 1, recurrenceUnit: event.rule?.recurrenceUnit || 'days',
    reminder: 'none', reminderCustom: 0, notes: event.notes || '', completed: false, externalUid: event.externalUid || ''
  }));
}

export function downloadIcs(appointments) {
  const blob = new Blob([appointmentsToIcs(appointments)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `samen-thuis-agenda-${new Date().toISOString().slice(0,10)}.ics`; anchor.hidden = true;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
