# Uitvoeringsplan – Samen Thuis

## 1. Nulmeting op 15 juli 2026

Samen Thuis is een statische, Nederlandstalige PWA op basis van HTML5, CSS3 en vanilla JavaScript ES-modules. De UI gebruikt hashrouting, IndexedDB is de directe offline bron en Supabase wordt optioneel gebruikt voor Auth, een gezamenlijk gezin, Realtime, Web Push en centrale synchronisatie. Netlify publiceert de repository zonder bouwstap.

De nulmeting is uitgevoerd vóór nieuwe implementatie. `npm test` geeft **45 geslaagde en 0 mislukte tests**. De startpagina op `http://localhost:8080/#home` opent zonder consolefouten of waarschuwingen. De werkmap was bij aanvang schoon.

### Volledig werkende bestaande basis

- dashboard met agenda, taken, boodschappen, maaltijden, voorraad, uitgaven, verjaardagen, huisdieren, activiteit, opslag en syncstatus;
- agenda met dag-, week-, maand-, lijst-, vandaag- en komende weergaven, zoeken, filters, herhaling, herinneringen, verjaardagen, soft delete, herstel en ICS-import/export;
- boodschappen, taken, maaltijdplanner/recepten, voorraad, uitgaven, huisdieren en uitjes met lokale CRUD;
- gezinsleden, categorieën, thema, datum/tijd, valuta en notificatie-instellingen;
- sjablonen voor boodschappen, taken en eenvoudige inpaklijsten;
- algemene zoekfunctie, snelle acties, activiteit en centrale prullenbak;
- JSON-back-up, gevalideerde import, samenvoegen/vervangen en lokale veiligheidskopie;
- Supabase e-mail/wachtwoordauthenticatie, gezinsaccounts en eenmalige uitnodigingscodes;
- generieke `family_records`-synchronisatie, IndexedDB-outbox, Realtime-signaal, open/voorgrond/online-triggers en PWA-achtergrondpogingen;
- manifest, appiconen, service worker, versiecache, updatebanner en mobiele installatiehulp;
- RLS voor bestaande gezinsgegevens en uitsluitend een openbare publishable key in de frontend.

### Gedeeltelijk werkende of te verbeteren onderdelen

- conflicten worden gedetecteerd en gemarkeerd, maar er is nog geen scherm om beide versies te vergelijken en handmatig te kiezen of samen te voegen;
- de prullenbak ondersteunt herstel, maar nog geen definitief verwijderen, bewaartermijn of versieherstel;
- paklijsten zijn eenvoudige tekstsjablonen en missen toewijzing, aantallen, essentieel-status, afspraakkoppeling en historie;
- afbeeldingen en documenten hebben nog geen generieke compressie-, Blob- en privé-Storage-laag;
- Supabase SQL staat hoofdzakelijk in één installatiescript; er ontbreken genummerde, veilig herhaalbare migraties;
- de synchronisatie haalt alle centrale records op en gebruikt nog geen cursor/paginering;
- de routefout bevat één inline `onclick`; dit wordt vervangen door een normale eventlistener;
- het pakket bevat alleen een Node-testscript; lint-, statische PWA-, database- en uitgebreide browsertests ontbreken;
- de bestaande automatische tests dekken nog geen echte lokale Supabase-omgeving, productie-RLS of Storage-policies;
- een live productietest met drie echte gebruikers wordt niet uitgevoerd zonder gescheiden testaccounts en expliciet veilige testdata.

### Ontbrekende functies

De volgende domeinen ontbreken nog: prikbord, inbox, dagelijks overzicht, vertrek-assistent, uitgebreide paklijsten, kindprofielen, routines, gezinsmodi, onderhoud, apparaten/garantie, “Wat ligt waar?”, lenen, cadeaukluis, afvalkalender, oppasmodus, noodkaart, abonnementen, spaardoelen, prijsgeheugen, restjesplanner, bezoekplanner, besliswiel, beloningen/uitdagingen, gezinstijdlijn, bucketlist, klusprojecten en beperkte versiegeschiedenis.

## 2. Bestaande architectuur die behouden blijft

1. **Presentatie** – `router.js`, views en herbruikbare modals. Schermen doen geen directe IndexedDB- of Supabase-mutaties.
2. **Services** – validatie, afgeleide overzichten, conversies, bestanden, back-up/import en synchronisatie.
3. **Repositories** – uniforme API met `getAll`, `getById`, `create`, `update`, `softDelete` en `restore`. Een mutatie schrijft record, activiteit en outbox atomair.
4. **IndexedDB** – directe offline bron voor de UI. `localStorage` blijft beperkt tot kleine interfacevoorkeuren en apparaat-ID.
5. **Supabase-adapter** – dezelfde outbox en dezelfde `family_records`-tabel blijven de centrale synchronisatielaag. Er komt geen tweede auth- of syncsysteem.
6. **PWA-laag** – service worker cachet uitsluitend de statische app-shell. Persoonlijke data blijft in IndexedDB en wordt niet in Cache Storage geplaatst.

## 3. Uitbreiding van het lokale datamodel

De database gaat van versie 3 naar versie 4. Bestaande stores en records blijven onaangetast.

Nieuwe stores:

- `assistantRecords`: records van alle nieuwe gezinsassistentmodules, met een index op `module`, `status`, `date`, `updatedAt`, `deletedAt` en `syncStatus`;
- `recordHistory`: maximaal tien vorige versies per belangrijk record, geïndexeerd op brononderdeel, record-ID en wijzigingsdatum;
- `files`: privé lokale Blob-opslag met metadata, MIME-type, bestandsgrootte, hash, synchronisatiestatus en koppeling aan een record.

Ieder synchroniseerbaar record behoudt de bestaande camelCase-clientvelden `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `deviceId`, `syncStatus` en `updatedBy`. De Supabase-laag zet deze veilig om naar de bestaande snake_case-kolommen `family_id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by` en `device_id` waar fysieke kolommen worden gebruikt. De payload blijft achterwaarts compatibel.

Er komt één `ModuleRepository` boven `assistantRecords`. Iedere module krijgt een eigen repository-instantie en eigen `entityType`, zodat schermen en synchronisatie domeinspecifiek blijven zonder tientallen identieke IndexedDB-stores te maken. UUID’s voorkomen sleutelbotsingen. Het is geen tweede synchronisatielaag: alle wijzigingen gaan door `BaseRepository`, activiteit en de bestaande outbox.

## 4. Veilige Supabase-migraties

Nieuwe, genummerde migraties komen onder `supabase/migrations/`:

1. uitbreiding van de toegestane `entity_type`-waarden;
2. extra metadata voor incrementele synchronisatie en indexen;
3. RLS-regels voor servermatig verborgen cadeau-items;
4. een privé Storage-bucket met gezinsgebonden paden, MIME- en groottebeleid;
5. RPC-uitbreiding die het gezin uitsluitend uit `auth.uid()` afleidt;
6. idempotente Realtime-publicatie en bijgewerkte grants.

Geen bestaande tabel, kolom, gebruiker, policy of productierecord wordt verwijderd. Cadeau-uitsluiting wordt in RLS én de sync-RPC afgedwongen; een uitgesloten gebruiker ontvangt het record niet via select, Realtime of pull. Een lokale pincode is alleen een extra schermslot en nooit serverautorisatie.

## 5. Synchronisatie-uitbreiding

- nieuwe moduletypen worden toegevoegd aan één centrale entiteitscatalogus die venster- en service-workersync delen;
- pull gebruikt een opgeslagen `server_updated_at`-cursor en begrensde pagina’s, met een volledige eerste synchronisatie als veilige terugval;
- Realtime blijft alleen een wake-upsignaal; records worden altijd opnieuw via RLS opgehaald;
- remote records worden zonder nieuwe outboxmutatie toegepast;
- dubbele events worden op `entityType + recordId + version` genegeerd;
- een conflict bewaart lokale en centrale versies in `recordHistory` en krijgt `syncStatus: conflict`;
- een conflictscherm toont verschillende velden en biedt lokaal behouden, centraal behouden of veldgewijs samenvoegen;
- uitloggen of gezin wisselen ruimt Realtime-kanalen, timers en cursors op;
- Background Sync blijft best effort; openen, voorgrond en internetherstel blijven de betrouwbare terugval.

## 6. Nieuwe presentatie en navigatie

Nieuwe onderdelen worden niet als tientallen losse hoofdnavigatieknoppen getoond. Onder **Meer** komen groepen:

- **Vandaag**: dagelijks overzicht, routines en gezinsmodus;
- **Gezin**: prikbord, inbox, kinderen, oppasmodus, noodkaart, beloningen en tijdlijn;
- **Plannen**: vertrek, paklijsten, bezoekplanner, besliswiel en bucketlist;
- **Thuis**: onderhoud, apparaten, opslaglocaties, leenlijst, afvalkalender en klusprojecten;
- **Geld**: cadeaukluis, abonnementen, spaardoelen en prijsgeheugen;
- **Eten**: restjesplanner naast de bestaande maaltijdplanner.

Een generieke, schema-gestuurde moduleview levert consistente zoeken/filteren, CRUD, soft delete, herstel, validatie, lege toestanden en toegankelijke formulieren. Specifieke workflows krijgen eigen views/services: dagelijks overzicht, vertrek-assistent, paklijst, routines, gezinsmodi, oppasmodus, noodkaart/print, restjesmatching, besliswiel, beloningen en conflictoplossing.

## 7. Bestanden en privacy

- afbeeldingen worden vóór lokale opslag verkleind en gecomprimeerd;
- standaard maximaal 1600 × 1600 pixels en maximaal 1 MB na compressie;
- documenten maximaal 5 MB en alleen expliciet toegestane MIME-types;
- IndexedDB bewaart een Blob, nooit onbegrensde Base64 in een recordpayload;
- online bestanden gaan alleen naar een privébucket met pad `familyId/recordId/fileId`;
- downloads gebruiken korte, geautoriseerde requests of signed URLs;
- definitief verwijderen ruimt het bijbehorende bestand op;
- kind-, nood- en cadeaugegevens krijgen zichtbare privacywaarschuwingen;
- medische gegevens worden alleen door het gezin ingevoerd en niet geïnterpreteerd.

## 8. Bestanden die worden toegevoegd of aangepast

Belangrijkste nieuwe bestanden:

- `js/modules/assistant-modules.js` – modulecatalogus, velden, filters en navigatiegroepen;
- `js/repositories/module-repository.js`, `history-repository.js`, `file-repository.js`;
- `js/services/assistant-service.js`, `conversion-service.js`, `file-service.js`, `daily-overview-service.js`, `departure-service.js`, `packing-service.js`, `routine-service.js`, `leftovers-service.js`, `finance-tools-service.js`, `conflict-service.js`;
- `js/views/assistant-view.js`, `daily-view.js`, `departure-view.js`, `packing-view.js`, `routines-view.js`, `babysitter-view.js`, `emergency-view.js`, `leftovers-view.js`, `decision-wheel-view.js`, `conflicts-view.js`;
- `supabase/migrations/*.sql`;
- aanvullende unit-, integratie-, browser-, beveiligings-, performance- en PWA-tests;
- `IMPLEMENTATION_REPORT.md` en `TEST_REPORT.md`.

Bestaande aanpassingen zijn nodig in `config.js`, IndexedDB-schema/migraties, `BaseRepository`, state, router, dashboard, agendaformulier, meerweergave, zoeken, back-up/import, prullenbak, instellingen, CSS, service worker, manifest, Netlify-headers, README en Supabase SQL.

## 9. Risico’s voor bestaande gegevens

- **Schema-upgrade:** uitsluitend nieuwe stores en indexen; geen bestaande stores worden gewist.
- **Sync-entiteiten:** oude clients kennen nieuwe typen niet en negeren ze. De server bewaart ze; na update worden ze zichtbaar.
- **Gedeelde lokale module-store:** alle records dragen een onveranderlijk `module`-veld en UUID. Repositories filteren dit veld altijd.
- **Cadeaugeheimen:** bestaande RLS is onvoldoende voor uitsluiting per gebruiker; de cadeaukluis wordt pas als online-veilig beschouwd nadat de nieuwe migratie is toegepast.
- **Bestanden:** een mislukte upload mag een lokaal record nooit blokkeren. Bestanden houden een eigen retry-status.
- **Databasewijzigingen op productie:** migratiebestanden worden geleverd en statisch getest, maar niet zonder controle rechtstreeks op productie uitgevoerd.
- **Browserbeperkingen:** iOS garandeert geen periodieke achtergrondtaak. De UI belooft daarom geen exacte achtergrondfrequentie.

## 10. Testplan per laag

- **Unit:** validatie, modulefilters, routines, paklijsten, prijs-/spaarberekeningen, restjesmatching, soft deletes, geschiedenis, bestandsvalidatie en cadeauzichtbaarheid.
- **Repository/integratie:** lokale CRUD, outbox, remote apply, herstel, conversies zonder duplicaten, import/export en cursor/paginering.
- **Sync:** offline mutatie, push, pull, Realtime-wake-up, dubbele events, conflict, gezin wisselen, uitloggen en sessieherstel.
- **RLS/Storage:** SQL-policytests voor gebruikers A/B in gezin 1 en C in gezin 2; cadeaus en private bestanden. Alleen in een lokale of expliciete testomgeving, nooit met productiegegevens.
- **E2E:** alle gevraagde nieuwe workflows plus bestaande kernformulieren.
- **Responsive:** 360×800, 390×844, 412×915, 768×1024, 1024×768 en 1440×900.
- **Performance:** 1.000 afspraken, taken en boodschappen; 500 prijzen en momenten; 250 apparaten en onderhoudsitems. Metingen worden eerlijk in `TEST_REPORT.md` opgenomen.
- **PWA:** manifest, service worker, volledige app-shell, offline herladen, cache-update, iOS-hulp en geen API-responses in Cache Storage.
- **Console:** ieder scherm controleren op JavaScriptfouten, afgewezen promises, 404’s, dubbele listeners en service-workerfouten.

## 11. Uitvoervolgorde

1. nulmeting en dit plan;
2. bestaande fouten en inline handler herstellen;
3. IndexedDB-versie 4, repositories, geschiedenis en bestanden;
4. veilige Supabase-migraties, RLS en Storage;
5. generieke synccatalogus, cursor en conflictservice;
6. prikbord en inbox;
7. dagelijks overzicht, vertrek-assistent en paklijsten;
8. kinderen, routines en gezinsmodi;
9. onderhoud, apparaten, opslaglocaties en lenen;
10. cadeaukluis, afval, oppasmodus en noodkaart;
11. abonnementen, spaardoelen en prijsgeheugen;
12. restjes-, bezoek-, beslis- en beloningsfuncties;
13. tijdlijn, bucketlist en klusprojecten;
14. zoeken, dashboard, prullenbak, back-up en navigatie integreren;
15. responsive ontwerp en toegankelijkheid;
16. alle automatische en handmatige controles;
17. README, implementatie- en testrapport afronden.

Na iedere implementatiefase worden de bestaande Node-tests opnieuw uitgevoerd. Een fase wordt alleen als geslaagd gedocumenteerd wanneer het bijbehorende commando werkelijk is uitgevoerd.

## 12. Uitvoeringsstatus

De lokale implementatiefasen 1 tot en met 17 zijn afgerond. Versie 3.0.1 voegt een volledige Web Push-keten toe: automatische apparaatinschrijving na gezinskoppeling, een toestemmingspopup, een echte testmelding, servergestuurde herinneringen voor alle belangrijke onderdelen, een minuutcron, bezorgdeduplicatie en een normale Android/iPhone/PWA-notificatie vanuit de service worker.

De automatische en handmatige controles staan met echte resultaten in `TEST_REPORT.md`. Beide Supabase-migraties en de vernieuwde Edge Function zijn op 15 juli 2026 op het gekoppelde productieproject toegepast. De minuutcron is actief en meerdere serverruns gaven HTTP 200. Een echte apparaatmelding moet per Android/iPhone nog via de knop **Testmelding sturen** worden bevestigd, omdat de gecontroleerde desktopbrowser geen mobiele pushprompt heeft geaccepteerd.
