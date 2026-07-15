import { uuid } from '../utils/uuid.js';

const PRESETS = Object.freeze({
  'Vakantie': ['Paspoorten','Portemonnee','Opladers','Medicatie','Kleding','Toiletspullen','Knuffels'],
  'Weekend weg': ['Kleding','Toiletspullen','Opladers','Medicatie','Pyjama'],
  'Dagje uit': ['Drinken','Tussendoortjes','Zonnebrand','Reservekleding','Tickets'],
  'Zwemmen': ['Zwemkleding','Handdoeken','Zwembandjes','Shampoo','Droge kleding'],
  'Strand': ['Handdoeken','Zonnebrand','Zwemkleding','Drinken','Parasol'],
  'Dierentuin': ['Tickets','Drinken','Lunch','Kinderwagen','Zonnebrand'],
  'Logeren': ['Pyjama','Knuffel','Tandenborstel','Kleding','Medicatie'],
  'Ziekenhuis': ['Identiteitsbewijs','Verzekeringspas','Medicatieoverzicht','Oplader'],
  'Arts': ['Identiteitsbewijs','Verzekeringspas','Medicatieoverzicht','Vragenlijst'],
  'Fotoshoot': ['Camera','Accu’s','Geheugenkaarten','Lampen','Outfits','Contracten'],
  'Familiebezoek': ['Cadeau','Kinderbenodigdheden','Medicatie','Opladers'],
  'Uitje met kinderen': ['Drinken','Snacks','Reservekleding','Doekjes','Zonnebrand']
});

export function presetPackingItems(type) {
  return (PRESETS[type] || []).map((text) => ({ id: uuid(), text, quantity: 1, category: 'Algemeen', memberId: '', essential: true, done: false, note: '' }));
}

export function packingProgress(list) {
  const items = list.items || [];
  const completed = items.filter((item) => item.done).length;
  return { total: items.length, completed, missing: items.filter((item) => !item.done), percentage: items.length ? Math.round(completed / items.length * 100) : 0 };
}

export { PRESETS as PACKING_PRESETS };
