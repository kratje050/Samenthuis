import { fromDateKey } from '../utils/dates.js';
import { uuid } from '../utils/uuid.js';

export const DEPARTURE_PRESETS = Object.freeze({
  Opvang: ['Tas met reservekleding', 'Drinkbeker', 'Knuffel of speen', 'Benodigde medicatie'],
  School: ['Schooltas', 'Lunch en drinken', 'Gymspullen', 'Sleutels'],
  Zwemmen: ['Zwemkleding', 'Handdoek', 'Zwembandjes', 'Droge kleding'],
  Fotoshoot: ['Camera en lenzen', 'Opgeladen accu’s', 'Geheugenkaarten', 'Lampen', 'Outfits en contracten'],
  Huisarts: ['Identiteitsbewijs', 'Verzekeringspas', 'Medicatieoverzicht', 'Vragenlijst'],
  Ziekenhuis: ['Identiteitsbewijs', 'Verzekeringspas', 'Medicatieoverzicht', 'Oplader', 'Comfortspullen'],
  Dierenarts: ['Dierenpaspoort', 'Medicatieoverzicht', 'Riem of reismand', 'Vragen voor de dierenarts'],
  Familiebezoek: ['Cadeau', 'Kinderbenodigdheden', 'Medicatie', 'Opladers'],
  'Dagje uit': ['Tickets', 'Drinken', 'Snacks', 'Reservekleding', 'Zonnebrand'],
  'Weekend weg': ['Kleding', 'Toiletspullen', 'Medicatie', 'Opladers', 'Sleutels'],
  Vakantie: ['Paspoorten', 'Portemonnee', 'Tickets', 'Medicatie', 'Opladers', 'Sleutels']
});

export function presetDepartureItems(type) {
  return (DEPARTURE_PRESETS[type] || []).map((text) => ({ id: uuid(), text, memberId: '', essential: true, done: false }));
}

export function departureDateTime(appointment) {
  if (!appointment?.date) return null;
  if (appointment.plannedDepartureTime) return fromDateKey(appointment.date, appointment.plannedDepartureTime);
  if (!appointment.startTime || !Number(appointment.travelMinutes)) return null;
  return new Date(fromDateKey(appointment.date, appointment.startTime).getTime() - Number(appointment.travelMinutes) * 60000);
}

export function departureStatus(appointment, packingList = null, now = new Date()) {
  const departure = departureDateTime(appointment);
  const appointmentItems = appointment.departureChecklist || [];
  const packingItems = packingList?.items || [];
  const items = [...appointmentItems, ...packingItems];
  const openItems = items.filter((item) => !item.done);
  const essentialOpen = openItems.filter((item) => item.essential);
  return {
    departure,
    minutesRemaining: departure ? Math.ceil((departure - now) / 60000) : null,
    items, openItems,
    essentialOpen,
    ready: openItems.length === 0
  };
}
