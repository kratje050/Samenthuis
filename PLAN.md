# Architectuurplan – Samen Thuis

## Doel en grenzen

Samen Thuis is een gratis, Nederlandstalige, mobile-first gezins-PWA. IndexedDB blijft op ieder apparaat de offline bron voor de UI. Versie 1.4 bevat optionele accounts, centrale Supabase-synchronisatie, PWA-achtergrondtaken en Web Push; zonder account werkt de app nog steeds volledig lokaal. `localStorage` bevat alleen kleine interfacevoorkeuren en het apparaat-ID. Sessies staan in een aparte IndexedDB-store.

## Architectuur

De app bestaat uit vijf duidelijke lagen:

1. **Presentatie** – routes, views en herbruikbare modals, meldingen en agendaonderdelen. Views praten nooit rechtstreeks met IndexedDB.
2. **Services** – validatie, herhaling, agendaquery's, notificaties en back-up/import.
3. **Repositories** – één repository per domein met een uniforme API (`getAll`, `getById`, `create`, `update`, `softDelete`, `restore`). Mutaties schrijven record en outbox-item in één IndexedDB-transactie.
4. **Opslag** – database-opening, schema en migraties. IndexedDB is de directe bron voor de UI; Supabase is na aanmelding de gedeelde gezinsbron.
5. **Synchronisatie** – de outbox-adapter pusht lokale mutaties via beveiligde RPC's en past centrale records zonder nieuwe outboxmutatie lokaal toe.
6. **PWA-achtergrondlaag** – de service worker kan dezelfde outbox zelfstandig verwerken, de korte Supabase-sessie met de refresh-token roteren en centrale records rechtstreeks in de bestaande IndexedDB-stores toepassen. Een Web Lock voorkomt dat venster en service worker tegelijk dezelfde wachtrij verwerken.

ES-modules houden onderdelen los gekoppeld. `state.js` bevat alleen runtime-status en een eventbus. `router.js` beheert hashroutes. De service worker cachet uitsluitend lokale appbestanden en gebruikt een versiegebonden cache met updatecontrole. De PWA-installatieservice vangt de Android-installatieprompt vroeg op en toont op mobiele browsers een eigen toegankelijke keuze; op iPhone geeft dezelfde dialoog de verplichte Safari-stappen.

## Datamodel

Alle domeinrecords bevatten minimaal:

- `id` (UUID);
- `createdAt`, `updatedAt`, `deletedAt`;
- `version` (oplopend geheel getal);
- `deviceId` (blijvend willekeurig apparaat-ID);
- `syncStatus` (`local`, `pending`, `synced`, `conflict`);
- `updatedBy` (gezinslid-ID of `device`/`system`).

Iedere mutatie levert daarnaast een outbox-record op met `changeId`, `entityType`, `recordId`, `operation`, `payload`, `version`, `changedAt`, `deviceId` en `processed`. Soft deletes behouden het bronrecord en gebruiken operatie `delete`.

### Object stores

- `appointments` – agenda-items inclusief herhaling, herinnering en voltooiing;
- `shopping` – gezamenlijke boodschappen;
- `tasks` – huishoudelijke taken en historie;
- `meals` – weekmaaltijden en recepten (`kind` onderscheidt beide);
- `inventory` – voorraad;
- `expenses` – handmatige uitgaven;
- `pets` – huisdieren, medicatie, vaccinaties en afspraken;
- `outings` – uitjes, ideeën en vakanties;
- `settings` – appinstellingen, gezinsleden en categorieën;
- `outbox` – lokale wijzigingswachtrij;
- `backups` – automatische veiligheidskopie vóór import.
- `activity` – atomair vastgelegde gezinsactiviteit;
- `templates` – herbruikbare boodschappen-, taken- en inpaklijsten;
- `cloud` – lokale sessie- en synchronisatiestatus, bewust buiten exports.

Indexen bestaan op veelgebruikte datum-, status-, categorie- en wijzigingsvelden. Lokale queries blijven eenvoudig en betrouwbaar; agenda-occurrences worden voor het zichtbare datumbereik door de agenda-service gegenereerd.

## Standaardgegevens

Bij de eerste start worden Roy, Demy, Miley en Navy met eigen kleuren en profieliconen toegevoegd. Ook worden de gevraagde categorieën en Nederlandse voorkeuren aangemaakt. Seed-data wordt idempotent geplaatst en niet opnieuw toegevoegd nadat een gebruiker instellingen aanpast.

## Agenda en herhaling

Een afspraak blijft één bronrecord. De recurrence-service projecteert occurrences voor een begrensd bereik en ondersteunt dagelijks, werkdagen, wekelijks, tweewekelijks, maandelijks, jaarlijks en een eigen dag/week/maandinterval met optionele einddatum. Agendaweergaven vragen uitsluitend occurrences voor hun eigen zichtbare bereik op. Zo blijft de app ook met honderden afspraken snel.

## Herinneringen

De reminder-service controleert tijdens gebruik periodiek welke herinneringen verschuldigd zijn. Met toestemming gebruikt de app browsernotificaties; anders verschijnen blijvende waarschuwingen in de app. Voor een gekoppeld gezin kan een Supabase Edge Function standaard Web Push versturen wanneer de PWA gesloten is. Supabase Cron controleert iedere minuut, een unieke afleveringssleutel voorkomt dubbele meldingen en verlopen browserinschrijvingen worden automatisch gedeactiveerd. De VAPID-privésleutel en croncode blijven uitsluitend in RLS-afgeschermde servertabellen.

## Gebruiksgemak en herstel

Een globale zoekservice leest alle actieve domeinrecords uitsluitend via repositories, normaliseert hoofdletters en accenten en levert begrensde, gesorteerde resultaten aan één zoekdialoog. Een vaste snelle-toevoegknop routeert naar de bestaande gevalideerde formulieren; er bestaat dus geen tweede schrijfpad.

De centrale prullenbak verzamelt soft-deleted records uit alle domeinrepositories en herstelt ze via de uniforme `restore()`-methode. De agenda behoudt daarnaast zijn eigen contextuele prullenbak. De datum van de laatste door de gebruiker gedownloade back-up is een kleine interfacevoorkeur in `localStorage` en wordt op dashboard en instellingen getoond; de back-upinhoud zelf blijft uit IndexedDB komen.

## Back-up en herstel

Export leest alle domeinstores en maakt één versieerbaar JSON-bestand. Authsessies blijven bewust buiten back-ups. Import valideert appnaam, schema-versie, verplichte secties en UUID's. Vóór iedere import wordt een volledige veiligheidskopie in `backups` opgeslagen. Vervangen wist pas na expliciete bevestiging de domeinstores; samenvoegen kiest per ID het record met de hoogste versie en daarna de nieuwste `updatedAt`. Geïmporteerde wijzigingen worden als pending geregistreerd zodat de actieve synchronisatielaag ze kan verwerken.

## PWA en cachebeleid

`manifest.json` maakt de app installeerbaar. De service worker gebruikt app-shell precaching, netwerk-eerst voor navigatie en cache-eerst voor lokale assets. Cache-namen bevatten de appversie; bij activatie worden oude caches verwijderd. De UI meldt een wachtende nieuwe service worker en laat de gebruiker bewust bijwerken.

## Toegankelijkheid en ontwerp

Semantische HTML, gekoppelde labels, toetsenbordbediening, zichtbare focus, live-regio's, voldoende kleurcontrast en aanraakvlakken van minimaal 44px zijn leidend. De warme crème/taupe/oudroze vormtaal gebruikt lokale SVG-iconen en systeemlettertypen. Telefoons krijgen ondernavigatie; vanaf tabletbreedte verschijnt een zijmenu.

## Teststrategie

- pure unit-tests voor UUID/validatie, herhaling, datumgrenzen en berekeningen;
- repository- en importtests in een echte browser-IndexedDB;
- integratietest voor CRUD, soft delete/herstel, taakherhaling en maaltijd → boodschappen;
- performancetest met honderden afspraken en boodschappen;
- handmatige browsercontrole op smal mobiel, tablet en desktop;
- PWA-controle van manifest, service-workerregistratie, offline herladen en cache-update;
- herlaadtest om gegevensbehoud te bevestigen.

## Fase 2: centrale database en automatische synchronisatie

Fase 2 is in versie 1.4 als **losse sync-adapter** naast de bestaande repositories geïmplementeerd; views en domeinopslag blijven intact. Supabase levert Auth, PostgreSQL, Cron en één Edge Function voor Web Push. Alleen de openbare publishable key staat in de client. De secret- en service-role keys worden nergens in de statische website gebruikt.

Het servermodel bestaat uit `families`, `family_members` en `family_records`. Accounts voor Roy en Demy kunnen via een gehashte, zeven dagen geldige en eenmalig bruikbare uitnodigingscode lid worden van één gezamenlijk gezin. Beveiligde RPC-functies bepalen het `familyId` uitsluitend via `auth.uid()`. Wachtwoorden worden alleen door Supabase Auth verwerkt, sessies gebruiken korte toegangstokens plus refresh-rotatie en alle communicatie loopt via HTTPS.

De sync-engine verwerkt de bestaande outbox:

1. bij openen van de app;
2. wanneer de app terug naar de voorgrond komt;
3. bij het `online`-event;
4. kort na iedere lokale wijziging, met debounce en retries;
5. iedere minuut zolang het appvenster zichtbaar is;
6. via een eenmalige Background Sync-taak na wachtende wijzigingen;
7. via Periodic Background Sync met een aangevraagd minimuminterval van vijftien minuten, waar ondersteund;
8. bij een Web Push-wake-up van de service worker.

Background Sync blijft afhankelijk van de planning en energieregels van de browser. Periodieke uitvoering is dus niet exact of gegarandeerd, zeker niet op iOS. De atomaire IndexedDB-outbox en de open/voorgrond/online-triggers zijn daarom altijd de bron van betrouwbaarheid en halen gemiste achtergrondmomenten later in.

Per wijziging stuurt de client record-ID, versie, wijzigingstijd, tombstone, payload en apparaat-ID. De server kiest eerst de hoogste versie en bij een gelijke versie de nieuwste wijzigingstijd. Een gelijktijdige afwijkende versie wordt als conflict teruggegeven en deterministisch samengevoegd; de synchronisatiestatus meldt dit. Na serverbevestiging wordt ieder bijbehorend outbox-item `processed: true` en het lokale record `synced`.

Row Level Security past autorisatie per gezin toe op iedere leesquery. Schrijfbewerkingen lopen uitsluitend via gecontroleerde RPC-functies met lidmaatschapscontrole, invoervalidatie en auditvelden. Automatische synchronisatie wordt pas geactiveerd na expliciete aanmelding; bij netwerk- of serveruitval blijft de offline app bruikbaar en blijft de outbox ongewijzigd wachten.

## Oplevervolgorde

1. database, schema, migraties en seeds;
2. repositories en outbox;
3. agenda en recurrence;
4. dashboard en overige domeinen;
5. back-up/import, instellingen en notificaties;
6. manifest/service worker;
7. automatische en visuele tests;
8. documentatie en eindcontrole op externe afhankelijkheden en onafgemaakte bediening.
