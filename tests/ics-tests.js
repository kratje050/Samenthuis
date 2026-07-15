import { appointmentsToIcs, icsToAppointments } from '../js/services/ics-service.js';
import { assert, equal, includes } from './test-utils.js';

export const icsTests = [
  ['ICS export bevat agenda en herhaling', () => {
    const text = appointmentsToIcs([{ id:'1',title:'Zwemles',date:'2026-07-15',startTime:'15:00',endTime:'16:00',allDay:false,location:'Zwembad',category:'Gezin',recurrence:'weekly',recurrenceUntil:'2026-08-31',members:[],reminder:'min15' }], { now:new Date('2026-07-15T10:00:00Z') });
    includes(text,'BEGIN:VCALENDAR'); includes(text,'SUMMARY:Zwemles'); includes(text,'RRULE:FREQ=WEEKLY;UNTIL=20260831T235959'); includes(text,'TRIGGER:-PT15M');
  }],
  ['ICS import leest afspraakvelden', () => {
    const events = icsToAppointments('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-1\r\nDTSTART:20260715T150000\r\nDTEND:20260715T160000\r\nSUMMARY:Zwemles\r\nLOCATION:Zwembad\r\nRRULE:FREQ=WEEKLY;INTERVAL=2\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
    equal(events.length,1); equal(events[0].date,'2026-07-15'); equal(events[0].startTime,'15:00'); equal(events[0].recurrence,'biweekly'); equal(events[0].externalUid,'test-1');
  }],
  ['ICS alarmtekst overschrijft de afspraakomschrijving niet', () => {
    const events = icsToAppointments('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-2\r\nDTSTART:20260715T150000\r\nSUMMARY:Controle\r\nDESCRIPTION:Echte omschrijving\r\nBEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\nDESCRIPTION:Alarmtekst\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
    equal(events[0].description, 'Echte omschrijving');
  }],
  ['ICS import weigert ander bestand', () => { let failed=false; try{icsToAppointments('geen agenda')}catch{failed=true}assert(failed); }]
];
