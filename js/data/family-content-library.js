import { MEMBER_IDS } from '../config.js';
import { addDays, startOfWeek, toDateKey } from '../utils/dates.js';

export const STARTER_LIBRARY_VERSION = 1;

const task = (key, title, category, minutes, cadence, options = {}) => ({
  key, title, category, minutes, cadence, priority: 'normal', memberRole: '', ...options
});

export const FAMILY_TASK_LIBRARY = Object.freeze([
  task('dishwasher-empty', 'Vaatwasser uitruimen', 'Huishouden', 10, 'daily'),
  task('dishwasher-fill', 'Vaatwasser inruimen en aanzetten', 'Huishouden', 10, 'daily'),
  task('table-reset', 'Eettafel afruimen en afnemen', 'Huishouden', 10, 'daily'),
  task('kitchen-surfaces', 'Aanrecht en kookplaat afnemen', 'Huishouden', 10, 'daily'),
  task('kitchen-floor-quick', 'Keukenvloer snel vegen', 'Huishouden', 10, 'daily'),
  task('living-room-reset', 'Woonkamer 10-minuten reset', 'Huishouden', 10, 'daily'),
  task('toys-baskets', 'Speelgoed terug in de bakken', 'Kinderen', 10, 'daily'),
  task('laundry-baskets', 'Losse was in de wasmanden verzamelen', 'Huishouden', 10, 'daily'),
  task('lunchboxes-clean', 'Broodtrommels en drinkbekers schoonmaken', 'Kinderen', 10, 'daily'),
  task('school-bags-check', 'Schooltassen voor morgen controleren', 'Kinderen', 10, 'daily'),
  task('mail-reset', 'Post en losse papieren opruimen', 'Administratie', 5, 'daily'),
  task('beds-make', 'Bedden opmaken', 'Huishouden', 10, 'daily'),
  task('child-one-room-reset', '{member}: kamer 10 minuten opruimen', 'Kinderen', 10, 'daily', { memberRole: 'child1' }),
  task('child-two-room-reset', '{member}: kamer 10 minuten opruimen', 'Kinderen', 10, 'daily', { memberRole: 'child2' }),

  task('vacuum-house', 'Hele huis stofzuigen', 'Huishouden', 60, 'weekly', { priority: 'high' }),
  task('mop-floors', 'Vloeren dweilen', 'Huishouden', 45, 'weekly'),
  task('bathroom-clean', 'Badkamer schoonmaken', 'Huishouden', 60, 'weekly', { priority: 'high' }),
  task('toilet-clean', 'Toilet schoonmaken', 'Huishouden', 25, 'weekly', { priority: 'high' }),
  task('dust-living', 'Woonkamer en vensterbanken afstoffen', 'Huishouden', 30, 'weekly'),
  task('parents-bed', 'Ouderlijk bed verschonen', 'Huishouden', 25, 'weekly'),
  task('child-one-bed', '{member}: bed verschonen', 'Kinderen', 20, 'weekly', { memberRole: 'child1' }),
  task('child-two-bed', '{member}: bed verschonen', 'Kinderen', 20, 'weekly', { memberRole: 'child2' }),
  task('towels-change', 'Handdoeken en keukendoeken vervangen', 'Huishouden', 15, 'weekly'),
  task('laundry-colours', 'Bonte was draaien en ophangen', 'Huishouden', 25, 'weekly'),
  task('laundry-whites', 'Witte was draaien en ophangen', 'Huishouden', 25, 'weekly'),
  task('laundry-fold', 'Schone was opvouwen en opruimen', 'Huishouden', 45, 'weekly'),
  task('meal-plan', 'Maaltijden voor de komende week plannen', 'Huishouden', 25, 'weekly'),
  task('shopping-list', 'Boodschappenlijst voor de week controleren', 'Huishouden', 15, 'weekly'),
  task('fridge-leftovers', 'Restjes en houdbaarheid in koelkast controleren', 'Huishouden', 15, 'weekly'),
  task('bins-empty', 'Prullenbakken in huis legen', 'Huishouden', 15, 'weekly'),
  task('waste-sort', 'Papier, PMD en glas verzamelen', 'Huishouden', 15, 'weekly'),
  task('school-messages', 'Schoolapps, mail en briefjes controleren', 'Kinderen', 20, 'weekly'),
  task('sports-bags', 'Sport- en gymtassen controleren', 'Kinderen', 15, 'weekly'),
  task('stairs-clean', 'Trap stofzuigen en leuning afnemen', 'Huishouden', 30, 'weekly'),
  task('hall-reset', 'Hal, jassen en schoenen opruimen', 'Huishouden', 20, 'weekly'),
  task('mirrors-clean', 'Spiegels schoonmaken', 'Huishouden', 20, 'weekly'),
  task('plants-water', 'Planten water geven en controleren', 'Huishouden', 15, 'weekly'),
  task('family-admin', 'Gezinsadministratie en openstaande berichten verwerken', 'Administratie', 30, 'weekly'),
  task('weekly-budget', 'Uitgaven van deze week bijwerken', 'Administratie', 20, 'weekly'),
  task('microwave-clean', 'Magnetron schoonmaken', 'Huishouden', 15, 'weekly'),
  task('cabinet-fronts', 'Keukenkastfronten afnemen', 'Huishouden', 25, 'weekly'),
  task('sofa-vacuum', 'Bank en kussens stofzuigen', 'Huishouden', 25, 'weekly'),
  task('handles-clean', 'Deurklinken en lichtknoppen afnemen', 'Huishouden', 15, 'weekly'),
  task('child-one-school-desk', '{member}: schoolspullen en bureau opruimen', 'Kinderen', 20, 'weekly', { memberRole: 'child1' }),
  task('child-two-school-desk', '{member}: schoolspullen en bureau opruimen', 'Kinderen', 20, 'weekly', { memberRole: 'child2' }),

  task('windows-downstairs', 'Ramen beneden zemen', 'Huishouden', 75, 'biweekly'),
  task('oven-clean', 'Oven grondig schoonmaken', 'Huishouden', 60, 'biweekly', { priority: 'high' }),
  task('shower-drains', 'Doucheputje en afvoeren schoonmaken', 'Huishouden', 30, 'biweekly', { priority: 'high' }),
  task('fridge-clean', 'Koelkast schoonmaken', 'Huishouden', 45, 'biweekly'),
  task('car-interior', 'Auto van binnen opruimen en stofzuigen', 'Overig', 45, 'biweekly'),
  task('bikes-check', 'Fietsen, banden en verlichting controleren', 'Overig', 30, 'biweekly'),
  task('toys-sort', 'Speelgoed uitzoeken en compleet maken', 'Kinderen', 45, 'biweekly'),
  task('pantry-stock', 'Voorraadkast controleren en ordenen', 'Huishouden', 30, 'biweekly'),
  task('medicine-stock', 'Medicijnen en verzorgingsvoorraad controleren', 'Administratie', 20, 'biweekly'),
  task('under-furniture', 'Onder banken en grote meubels schoonmaken', 'Huishouden', 45, 'biweekly'),

  task('washing-machine-clean', 'Wasmachine reinigen en filter controleren', 'Huishouden', 30, 'monthly'),
  task('dishwasher-clean', 'Vaatwasser reinigen en filter schoonmaken', 'Huishouden', 30, 'monthly'),
  task('extractor-clean', 'Afzuigkap en filters schoonmaken', 'Huishouden', 45, 'monthly'),
  task('freezer-check', 'Vriezer inventariseren en oude producten verwijderen', 'Huishouden', 30, 'monthly'),
  task('windows-upstairs', 'Ramen boven zemen', 'Huishouden', 75, 'monthly'),
  task('doors-skirting', 'Deuren, kozijnen en plinten afnemen', 'Huishouden', 60, 'monthly'),
  task('smoke-alarms', 'Rookmelders testen', 'Overig', 15, 'monthly', { priority: 'high' }),
  task('first-aid-check', 'EHBO-doos controleren en aanvullen', 'Administratie', 20, 'monthly'),
  task('kids-sizes', 'Kleding- en schoenmaten van de kinderen controleren', 'Kinderen', 30, 'monthly'),
  task('rotate-toys', 'Speelgoed rouleren of opbergen', 'Kinderen', 30, 'monthly'),
  task('photo-backup', 'Gezinsfoto’s en telefoonfoto’s back-uppen', 'Administratie', 30, 'monthly'),
  task('subscriptions-check', 'Abonnementen en vaste lasten controleren', 'Administratie', 30, 'monthly'),
  task('bathroom-deep', 'Badkamer grote schoonmaak', 'Huishouden', 90, 'monthly', { priority: 'high' }),
  task('wardrobes-reset', 'Kledingkasten ordenen', 'Huishouden', 75, 'monthly'),
  task('garden-round', 'Tuin, balkon of buitenruimte nalopen', 'Tuin', 60, 'monthly'),
  task('car-safety', 'Auto: vloeistoffen, banden en veiligheidsset controleren', 'Overig', 30, 'monthly'),

  task('kitchen-deep', 'Keuken grote schoonmaak', 'Huishouden', 150, 'quarterly', { priority: 'high' }),
  task('storage-deep', 'Berging, zolder of schuur opruimen', 'Huishouden', 180, 'quarterly'),
  task('season-garden', 'Tuin of balkon seizoensklaar maken', 'Tuin', 120, 'quarterly'),
  task('emergency-info', 'Noodinformatie en contactpersonen controleren', 'Administratie', 30, 'quarterly', { priority: 'high' }),
  task('medicine-expiry', 'Houdbaarheid van medicijnen controleren', 'Administratie', 30, 'quarterly'),
  task('radiators-clean', 'Radiatoren en ventilatieroosters reinigen', 'Huishouden', 75, 'quarterly'),
  task('curtains-clean', 'Gordijnen of raamdecoratie reinigen', 'Huishouden', 120, 'quarterly'),
  task('family-declutter', 'Gezinsronde: weggeven, verkopen of weggooien', 'Huishouden', 120, 'quarterly')
]);

const template = (key, title, items, notes) => ({ key, title, items, notes });

export const FAMILY_TASK_TEMPLATES = Object.freeze([
  template('quick-reset', '15 minuten snelle gezinsreset', [
    'Losse spullen terugleggen', 'Speelgoed in bakken', 'Kussens en dekens netjes', 'Eettafel leegmaken',
    'Aanrecht leegmaken', 'Schoenen en jassen opruimen', 'Prullenbak controleren', 'Was naar de wasmand'
  ], 'Handig voor onverwacht bezoek of een drukke dag.'),
  template('kitchen-deep', 'Keuken grondig schoonmaken', [
    'Koelkast leegmaken en afnemen', 'Oven schoonmaken', 'Magnetron schoonmaken', 'Afzuigkap reinigen',
    'Kastfronten afnemen', 'Voorraadkast ordenen', 'Aanrecht en kookplaat reinigen', 'Vloer stofzuigen en dweilen',
    'Afvalbakken schoonmaken', 'Vaatwasserfilter reinigen'
  ], 'Complete keukenronde.'),
  template('bathroom-deep', 'Badkamer grote schoonmaak', [
    'Douche en kranen ontkalken', 'Doucheputje schoonmaken', 'Wastafel en spiegel reinigen', 'Toilet grondig schoonmaken',
    'Tegels en voegen reinigen', 'Badkamerkast uitzoeken', 'Handdoeken vervangen', 'Prullenbak legen',
    'Ventilatie afnemen', 'Vloer dweilen'
  ], 'Alles voor een frisse badkamer.'),
  template('living-room', 'Woonkamer helemaal netjes', [
    'Losse spullen opruimen', 'Afstoffen', 'Vensterbanken afnemen', 'Bank stofzuigen', 'Kussens en plaids netjes',
    'Elektronica afstoffen', 'Speelgoed uitzoeken', 'Ramen of spiegels reinigen', 'Stofzuigen', 'Dweilen'
  ], 'Van snelle reset tot volledige schoonmaak.'),
  template('kids-rooms', 'Kinderkamers reset', [
    'Vuilnis en bekers verwijderen', 'Was in de wasmand', 'Bedden verschonen', 'Speelgoed sorteren',
    'Boeken terugzetten', 'Bureau opruimen', 'Kledingkast nalopen', 'Te kleine kleding apart',
    'Stofzuigen', 'Nachtkastje en vensterbank afnemen'
  ], 'Samen met de kinderen uit te voeren.'),
  template('laundry-day', 'Complete wasdag', [
    'Was verzamelen en sorteren', 'Witte was draaien', 'Bonte was draaien', 'Handdoeken wassen',
    'Beddengoed wassen', 'Was ophangen of drogen', 'Schone was opvouwen', 'Was per gezinslid verdelen',
    'Was opruimen', 'Wasmachinefilter controleren'
  ], 'Alle stappen van mand tot kast.'),
  template('school-week', 'Schoolweek voorbereiden', [
    'Schoolagenda en ouderapp controleren', 'Broodtrommels en bekers klaarzetten', 'Gymtassen controleren',
    'Schooltassen legen', 'Huiswerk en formulieren controleren', 'Kleding voor maandag klaarleggen',
    'Fietslampen controleren', 'Fruit en tussendoortjes controleren', 'Bijzondere schooldagen in agenda zetten',
    'Benodigde boodschappen toevoegen'
  ], 'Rustige start van de schoolweek.'),
  template('weekend-reset', 'Zondagse weekreset', [
    'Agenda van iedereen bekijken', 'Maaltijden plannen', 'Boodschappenlijst maken', 'Openstaande taken verdelen',
    'Was wegwerken', 'Koelkast controleren', 'School- en werktassen klaarzetten', 'Tank of laadstatus controleren',
    'Afvalkalender bekijken', 'Budget en uitgaven bijwerken'
  ], 'In één ronde klaar voor de nieuwe week.'),
  template('monthly-home', 'Maandelijkse huiscontrole', [
    'Rookmelders testen', 'EHBO-doos controleren', 'Voorraad controleren', 'Houdbaarheidsdata nalopen',
    'Wasmachine reinigen', 'Vaatwasser reinigen', 'Afzuigkap reinigen', 'Afvoeren doorspoelen',
    'Abonnementen controleren', 'Gezinsfoto’s back-uppen', 'Speelgoed rouleren', 'Kledingmaten kinderen controleren'
  ], 'Veiligheid, apparaten en administratie.'),
  template('spring-clean', 'Grote voorjaarsschoonmaak', [
    'Ramen binnen en buiten', 'Gordijnen reinigen', 'Deuren en kozijnen afnemen', 'Plinten reinigen',
    'Radiatoren reinigen', 'Kasten uitzoeken', 'Berging of zolder opruimen', 'Tuin of balkon klaarmaken',
    'Winterkleding opbergen', 'Spullen weggeven of verkopen', 'Matrassen luchten', 'Onder meubels schoonmaken'
  ], 'Seizoensronde voor het hele gezin.'),
  template('holiday-home', 'Huis klaar voor vakantie', [
    'Koelkast leeghalen', 'Afval wegbrengen', 'Vaatwasser leeg achterlaten', 'Was wegwerken',
    'Planten water geven of oppas regelen', 'Ramen en deuren controleren', 'Stekkers en apparaten controleren',
    'Verwarming instellen', 'Post en pakketjes regelen', 'Noodcontact achterlaten', 'Auto controleren',
    'Laatste foto van belangrijke documenten maken'
  ], 'Voor vertrek zonder twijfel.'),
  template('birthday-prep', 'Verjaardag thuis voorbereiden', [
    'Gastenlijst controleren', 'Boodschappen maken', 'Taart of traktatie regelen', 'Cadeaus inpakken',
    'Woonkamer opruimen', 'Toilet en badkamer schoonmaken', 'Koelkast vrijmaken', 'Servies en bekers klaarzetten',
    'Muziek en activiteiten kiezen', 'Jassen- en schoenenplek maken', 'Fotoapparaat of telefoon opladen',
    'Opruimtaken voor na afloop verdelen'
  ], 'Van uitnodiging tot opruimen.')
]);

const routine = (key, title, days, startTime, memberRole, items) => ({
  key, title, days, startTime, memberRole, items
});

export const FAMILY_ROUTINE_LIBRARY = Object.freeze([
  routine('family-morning', 'Gezinsstart in de ochtend', ['1','2','3','4','5'], '07:00', '', [
    'Gordijnen open en kort luchten', 'Ontbijttafel klaarzetten', 'Broodtrommels en drinken pakken',
    'Agenda en bijzonderheden controleren', 'Vaatwasser uitruimen', 'Tassen bij de deur'
  ]),
  routine('child-one-school', '{member}: klaar voor school', ['1','2','3','4','5'], '07:15', 'child1', [
    'Aankleden', 'Ontbijten', 'Tanden poetsen', 'Haren doen', 'Broodtrommel en beker pakken',
    'Schooltas controleren', 'Jas en schoenen aan'
  ]),
  routine('child-two-school', '{member}: klaar voor school', ['1','2','3','4','5'], '07:15', 'child2', [
    'Aankleden', 'Ontbijten', 'Tanden poetsen', 'Haren doen', 'Broodtrommel en beker pakken',
    'Schooltas controleren', 'Jas en schoenen aan'
  ]),
  routine('after-school', 'Na-schoolse gezinsreset', ['1','2','3','4','5'], '15:30', '', [
    'Tassen legen', 'Broodtrommels en bekers naar keuken', 'Brieven of bijzonderheden doorgeven',
    'Jassen en schoenen opruimen', 'Even drinken en fruit', 'Huiswerk of planning bekijken'
  ]),
  routine('child-one-evening', '{member}: avondroutine', ['0','1','2','3','4','5','6'], '19:00', 'child1', [
    'Speelgoed opruimen', 'Kleding voor morgen klaarleggen', 'Wassen of douchen', 'Pyjama aan',
    'Tanden poetsen', 'Tas controleren', 'Rustig leesmoment'
  ]),
  routine('child-two-evening', '{member}: avondroutine', ['0','1','2','3','4','5','6'], '19:00', 'child2', [
    'Speelgoed opruimen', 'Kleding voor morgen klaarleggen', 'Wassen of douchen', 'Pyjama aan',
    'Tanden poetsen', 'Tas controleren', 'Rustig leesmoment'
  ]),
  routine('kitchen-close', 'Keuken sluiten', ['0','1','2','3','4','5','6'], '20:00', '', [
    'Restjes bewaren', 'Vaatwasser vullen en aanzetten', 'Aanrecht leeg en schoon', 'Tafel afnemen',
    'Afval controleren', 'Keukenvloer snel vegen', 'Ontbijtspullen voor morgen controleren'
  ]),
  routine('sunday-reset', 'Zondagse gezinsplanning', ['0'], '18:00', '', [
    'Weekagenda samen bekijken', 'Maaltijden kiezen', 'Boodschappen controleren', 'Taken verdelen',
    'School- en werktassen klaarzetten', 'Kleding en sportspullen controleren', 'Afvalmomenten bekijken'
  ])
]);

const challenge = (key, title, cycle, metric, goal, options = {}) => ({
  key, title, cycle, metric, goal, audience: 'family', rewardPoints: Math.max(10, Math.round(goal / 2)), ...options
});

export const FAMILY_CHALLENGE_LIBRARY = Object.freeze([
  challenge('week-200-points', 'Samen 200 punten in één week', 'weekly', 'points', 200, { progressUnit: 'punten' }),
  challenge('week-400-points', 'Superweek: samen 400 punten', 'weekly', 'points', 400, { progressUnit: 'punten' }),
  challenge('week-15-tasks', 'Vijftien taken samen afgerond', 'weekly', 'tasks', 15),
  challenge('week-30-tasks', 'Gezinsmachine: dertig taken', 'weekly', 'tasks', 30),
  challenge('week-adults-12', 'Volwassenenteam: twaalf taken', 'weekly', 'tasks', 12, { audience: 'adults' }),
  challenge('week-kids-12', 'Kinderteam: twaalf helptaken', 'weekly', 'tasks', 12, { audience: 'children' }),
  challenge('week-quick-10', 'Tien snelle overwinningen', 'weekly', 'quick', 10, { maxMinutes: 15 }),
  challenge('week-high-5', 'Vijf belangrijke taken weggewerkt', 'weekly', 'priority', 5, { priorities: ['high','urgent'] }),
  challenge('week-kitchen-7', 'Keukenhelden: zeven keukenklussen', 'weekly', 'keywords', 7, { keywords: ['keuken','vaatwasser','aanrecht','kookplaat','tafel','oven','koelkast'] }),
  challenge('week-laundry-6', 'Wasberg bedwongen', 'weekly', 'keywords', 6, { keywords: ['was','handdoeken','beddengoed','bed verschonen'] }),
  challenge('week-bathroom-4', 'Badkamerblinkers', 'weekly', 'keywords', 4, { keywords: ['badkamer','toilet','wc','douche','wastafel'] }),
  challenge('week-tidy-10', 'Opgeruimd staat netjes', 'weekly', 'keywords', 10, { keywords: ['opruimen','reset','speelgoed','spullen terugleggen','sorteren'] }),
  challenge('week-school-6', 'Schoolweek zonder stress', 'weekly', 'keywords', 6, { keywords: ['school','gymtas','broodtrommel','sporttas','huiswerk'] }),
  challenge('week-unpopular-3', 'Niet leuk, wel gedaan', 'weekly', 'keywords', 3, { keywords: ['toilet','wc','afvoer','oven','koelkast','prullenbak','afval'] }),
  challenge('week-admin-4', 'Administratie op orde', 'weekly', 'category', 4, { categories: ['Administratie'] }),
  challenge('week-household-20', 'Huishoudmarathon', 'weekly', 'category', 20, { categories: ['Huishouden'] }),
  challenge('week-children-10', 'Alles voor de kinderen geregeld', 'weekly', 'category', 10, { categories: ['Kinderen'] }),
  challenge('week-garden-4', 'Groene vingers', 'weekly', 'category', 4, { categories: ['Tuin'] }),

  challenge('month-1000-points', 'Maandmissie: 1.000 punten', 'monthly', 'points', 1000, { progressUnit: 'punten' }),
  challenge('month-2000-points', 'Gouden gezinsmaand: 2.000 punten', 'monthly', 'points', 2000, { progressUnit: 'punten' }),
  challenge('month-60-tasks', 'Zestig taken in één maand', 'monthly', 'tasks', 60),
  challenge('month-100-tasks', 'Honderd keer samen aangepakt', 'monthly', 'tasks', 100),
  challenge('month-adults-35', 'Volwassenen: 35 taken', 'monthly', 'tasks', 35, { audience: 'adults' }),
  challenge('month-kids-30', 'Kinderen: 30 helptaken', 'monthly', 'tasks', 30, { audience: 'children' }),
  challenge('month-quick-30', 'Dertig klusjes onder een kwartier', 'monthly', 'quick', 30, { maxMinutes: 15 }),
  challenge('month-high-12', 'Twaalf hoge prioriteiten afgerond', 'monthly', 'priority', 12, { priorities: ['high','urgent'] }),
  challenge('month-kitchen-25', 'Keuken een maand lang bijgehouden', 'monthly', 'keywords', 25, { keywords: ['keuken','vaatwasser','aanrecht','kookplaat','tafel','oven','koelkast'] }),
  challenge('month-laundry-20', 'Wasexpert van de maand', 'monthly', 'keywords', 20, { keywords: ['was','handdoeken','beddengoed','bed verschonen'] }),
  challenge('month-bathroom-12', 'Frisse badkamer-maand', 'monthly', 'keywords', 12, { keywords: ['badkamer','toilet','wc','douche','wastafel'] }),
  challenge('month-declutter-15', 'Ontspullen en opruimen', 'monthly', 'keywords', 15, { keywords: ['opruimen','uitzoeken','weggeven','verkopen','sorteren','ordenen'] }),
  challenge('month-school-20', 'Schoolzaken helemaal onder controle', 'monthly', 'keywords', 20, { keywords: ['school','gymtas','broodtrommel','sporttas','huiswerk'] }),
  challenge('month-unpopular-10', 'Tien vervelende klussen verslagen', 'monthly', 'keywords', 10, { keywords: ['toilet','wc','afvoer','oven','koelkast','prullenbak','afval'] }),
  challenge('month-admin-12', 'Papierwerk-kampioen', 'monthly', 'category', 12, { categories: ['Administratie'] }),
  challenge('month-household-60', 'Een maand lang een rustig huis', 'monthly', 'category', 60, { categories: ['Huishouden'] }),
  challenge('month-children-30', 'Kinderzaken goed geregeld', 'monthly', 'category', 30, { categories: ['Kinderen'] }),
  challenge('month-outdoor-12', 'Tuin en buitenruimte bijgehouden', 'monthly', 'category', 12, { categories: ['Tuin'] })
]);

const PREFIXES = Object.freeze({ task: '31000000', challenge: '32000000', template: '33000000', routine: '34000000' });

export function starterRecordId(kind, index) {
  return `${PREFIXES[kind]}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function resolveMember(role, members = []) {
  if (!role) return null;
  const fallbacks = {
    adult1: members[0], adult2: members[1],
    child1: members.find((member) => member.id === MEMBER_IDS.miley) || members[2],
    child2: members.find((member) => member.id === MEMBER_IDS.navy) || members[3]
  };
  return fallbacks[role] || null;
}

function audienceIds(audience, members = []) {
  if (audience === 'adults') return members.filter((member) => [MEMBER_IDS.roy, MEMBER_IDS.demy].includes(member.id)).map((member) => member.id).length
    ? members.filter((member) => [MEMBER_IDS.roy, MEMBER_IDS.demy].includes(member.id)).map((member) => member.id)
    : members.slice(0, 2).map((member) => member.id);
  if (audience === 'children') return members.filter((member) => [MEMBER_IDS.miley, MEMBER_IDS.navy].includes(member.id)).map((member) => member.id).length
    ? members.filter((member) => [MEMBER_IDS.miley, MEMBER_IDS.navy].includes(member.id)).map((member) => member.id)
    : members.slice(2, 4).map((member) => member.id);
  return members.map((member) => member.id);
}

function cadenceSettings(cadence, index, now) {
  const settings = {
    daily: { recurrence: 'daily', interval: 1, unit: 'days', offset: 0 },
    weekly: { recurrence: 'weekly', interval: 1, unit: 'weeks', offset: index % 7 },
    biweekly: { recurrence: 'custom', interval: 2, unit: 'weeks', offset: index % 14 },
    monthly: { recurrence: 'monthly', interval: 1, unit: 'months', offset: index % 28 },
    quarterly: { recurrence: 'custom', interval: 3, unit: 'months', offset: index % 60 }
  }[cadence];
  return { ...settings, date: toDateKey(addDays(now, settings.offset)) };
}

export function challengePeriod(cycle, now = new Date()) {
  if (cycle === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toDateKey(start), endDate: toDateKey(end), periodKey: `monthly:${toDateKey(start)}` };
  }
  const start = startOfWeek(now, 1);
  const end = addDays(start, 6);
  return { startDate: toDateKey(start), endDate: toDateKey(end), periodKey: `weekly:${toDateKey(start)}` };
}

export function buildStarterTasks(members = [], now = new Date()) {
  return FAMILY_TASK_LIBRARY.map((definition, index) => {
    const member = resolveMember(definition.memberRole, members);
    const schedule = cadenceSettings(definition.cadence, index, now);
    return {
      id: starterRecordId('task', index),
      starterContent: true,
      starterKind: 'family-task',
      starterKey: definition.key,
      starterLibraryVersion: STARTER_LIBRARY_VERSION,
      title: definition.title.replace('{member}', member?.name || 'Kind'),
      description: 'Vooraf klaargezette gezinstaak. Pas de dag, herhaling of verantwoordelijke gerust aan.',
      assignedTo: member?.id || null,
      date: schedule.date,
      time: '',
      priority: definition.priority,
      category: definition.category,
      recurrence: schedule.recurrence,
      recurrenceInterval: schedule.interval,
      recurrenceUnit: schedule.unit,
      estimatedMinutes: definition.minutes,
      status: 'archived',
      reminderDisabled: true,
      starterMutedVersion: 1,
      note: `Gezinsbibliotheek · ${definition.cadence === 'daily' ? 'dagelijks' : definition.cadence === 'weekly' ? 'wekelijks' : definition.cadence === 'biweekly' ? 'iedere twee weken' : definition.cadence === 'monthly' ? 'maandelijks' : 'ieder kwartaal'}`
    };
  });
}

export function buildStarterTemplates() {
  return FAMILY_TASK_TEMPLATES.map((definition, index) => ({
    id: starterRecordId('template', index),
    starterContent: true,
    starterKind: 'task-template',
    starterKey: definition.key,
    starterLibraryVersion: STARTER_LIBRARY_VERSION,
    title: definition.title,
    templateType: 'tasks',
    items: definition.items.map((name) => ({ name })),
    notes: definition.notes
  }));
}

export function buildStarterRoutines(members = []) {
  return FAMILY_ROUTINE_LIBRARY.map((definition, index) => {
    const member = resolveMember(definition.memberRole, members);
    return {
      id: starterRecordId('routine', index),
      starterContent: true,
      starterKind: 'family-routine',
      starterKey: definition.key,
      starterLibraryVersion: STARTER_LIBRARY_VERSION,
      title: definition.title.replace('{member}', member?.name || 'Kind'),
      memberId: member?.id || '',
      days: definition.days,
      startTime: definition.startTime,
      items: definition.items.map((text, itemIndex) => ({
        id: `35000000-${String(index + 1).padStart(4, '0')}-4000-8000-${String(itemIndex + 1).padStart(12, '0')}`,
        text, quantity: 1, category: 'Routine', memberId: member?.id || '', essential: true, done: false, note: ''
      })),
      startDate: '',
      endDate: '',
      paused: false,
      reminderDisabled: true,
      starterMutedVersion: 1,
      status: 'archived',
      dailyProgress: {},
      completionHistory: []
    };
  });
}

export function buildStarterChallenges(members = [], now = new Date()) {
  return FAMILY_CHALLENGE_LIBRARY.map((definition, index) => {
    const period = challengePeriod(definition.cycle, now);
    const { metric, categories, priorities, keywords, maxMinutes } = definition;
    return {
      id: starterRecordId('challenge', index),
      starterContent: true,
      starterKind: 'family-challenge',
      starterKey: definition.key,
      starterLibraryVersion: STARTER_LIBRARY_VERSION,
      title: definition.title,
      rewardType: 'challenge',
      audience: definition.audience,
      memberIds: audienceIds(definition.audience, members),
      points: definition.rewardPoints,
      goal: definition.goal,
      progress: 0,
      progressUnit: definition.progressUnit || 'taken',
      startDate: period.startDate,
      endDate: period.endDate,
      cycle: definition.cycle,
      periodKey: period.periodKey,
      approvalRequired: false,
      approvedBy: '',
      notes: `Automatische uitdaging · voortgang door afgeronde ${definition.progressUnit === 'punten' ? 'taakpunten' : 'passende taken'}.`,
      status: 'active',
      autoRule: { metric, categories: categories || [], priorities: priorities || [], keywords: keywords || [], maxMinutes: maxMinutes || 0 }
    };
  });
}

export const STARTER_CONTENT_COUNTS = Object.freeze({
  tasks: FAMILY_TASK_LIBRARY.length,
  templates: FAMILY_TASK_TEMPLATES.length,
  routines: FAMILY_ROUTINE_LIBRARY.length,
  challenges: FAMILY_CHALLENGE_LIBRARY.length,
  templateItems: FAMILY_TASK_TEMPLATES.reduce((sum, item) => sum + item.items.length, 0)
});
