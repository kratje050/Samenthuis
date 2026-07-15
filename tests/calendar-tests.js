import { renderMonthCalendar } from '../js/components/calendar-month.js';
import { renderWeekCalendar } from '../js/components/calendar-week.js';
import { renderDayCalendar } from '../js/components/calendar-day.js';
import { includes } from './test-utils.js';

const appointment={id:'11111111-1111-4111-8111-111111111111',title:'Zwemles',date:'2026-07-15',occurrenceDate:'2026-07-15',startTime:'15:00',allDay:false,category:'Gezin',members:['roy']};
export const calendarTests=[
  ['dagweergave toont afspraak',()=>includes(renderDayCalendar([appointment],[{id:'roy',name:'Roy'}]),'Zwemles')],
  ['weekweergave toont alle zeven dagen',()=>includes(renderWeekCalendar(new Date(2026,6,15),[appointment],()=> '#000'),'Zwemles')],
  ['maandweergave toont afspraak en kalender',()=>{const html=renderMonthCalendar(new Date(2026,6,15),[appointment],()=> '#000');includes(html,'calendar-month');includes(html,'Zwemles')}]
];
