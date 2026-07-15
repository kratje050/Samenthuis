import { expandAppointment, nextTaskDate } from '../js/services/recurrence-service.js';
import { equal } from './test-utils.js';

export const recurrenceTests = [
  ['dagelijkse afspraak', () => equal(expandAppointment({id:'a',date:'2026-07-13',recurrence:'daily',deletedAt:null},new Date(2026,6,13),new Date(2026,6,17)).length,5)],
  ['werkdagen slaan weekend over', () => equal(expandAppointment({id:'a',date:'2026-07-17',recurrence:'weekdays',deletedAt:null},new Date(2026,6,17),new Date(2026,6,20)).length,2)],
  ['tweewekelijkse afspraak', () => equal(expandAppointment({id:'a',date:'2026-07-01',recurrence:'biweekly',deletedAt:null},new Date(2026,6,1),new Date(2026,6,31)).length,3)],
  ['maandelijkse datum blijft bruikbaar', () => equal(expandAppointment({id:'a',date:'2026-01-31',recurrence:'monthly',deletedAt:null},new Date(2026,0,1),new Date(2026,3,30)).length,4)],
  ['verjaardag uit geboortejaar keert jaarlijks terug', () => {
    const occurrences = expandAppointment({id:'birthday',date:'1950-07-20',recurrence:'yearly',deletedAt:null},new Date(2026,0,1),new Date(2026,11,31));
    equal(occurrences.length, 1);
    equal(occurrences[0].occurrenceDate, '2026-07-20');
  }],
  ['herhalen tot einddatum', () => equal(expandAppointment({id:'a',date:'2026-07-01',recurrence:'daily',recurrenceUntil:'2026-07-03',deletedAt:null},new Date(2026,6,1),new Date(2026,6,31)).length,3)],
  ['volgende herhalende taak', () => equal(nextTaskDate({date:'2026-07-15',recurrence:'weekly'},new Date(2026,6,15)),'2026-07-22')]
];
