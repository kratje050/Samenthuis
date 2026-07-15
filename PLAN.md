# Architectuurplan – Samen Thuis

## Doel en grenzen

Samen Thuis is een volledig gratis, Nederlandstalige, mobile-first gezins-PWA. Fase 1 werkt uitsluitend lokaal: alle gezinsgegevens staan in IndexedDB op het huidige apparaat. Er zijn geen accounts, externe API's, advertenties, analytics, cloudopslag of betaalde diensten. `localStorage` bevat alleen kleine interfacevoorkeuren.

## Architectuur

De app bestaat uit vier duidelijke lagen:

1. **Presentatie** – routes, views en herbruikbare modals, meldingen en agendaonderdelen. Views praten nooit rechtstreeks met IndexedDB.
2. **Services** – validatie, herhaling, agendaquery's, notificaties en back-up/import.
3. **Repositories** – één repository per domein met een uniforme API (`getAll`, `getById`, `create`, `update`, `softDelete`, `restore`). Mutaties schrijven record en outbox-item in één IndexedDB-transactie.
4. **Opslag** – database-opening, schema en migraties. IndexedDB is de enige bron van waarheid.

ES-modules houden onderdelen los gekoppeld. `state.js` bevat alleen runtime-status en een eventbus. `router.js` beheert hashroutes. De service worker cachet uitsluitend lokale appbestanden en gebruikt een versiegebonden cache met updatecontrole.

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

Indexen bestaan op veelgebruikte datum-, status-, categorie- en wijzigingsvelden. Queries blijven in fase 1 eenvoudig en betrouwbaar; agenda-occurrences worden voor het zichtbare datumbereik door de agenda-service gegenereerd.

## Standaardgegevens

Bij de eerste start worden Roy, Demy, Miley en Navy met eigen kleuren en profieliconen toegevoegd. Ook worden de gevraagde categorieën en Nederlandse voorkeuren aangemaakt. Seed-data wordt idempotent geplaatst en niet opnieuw toegevoegd nadat een gebruiker instellingen aanpast.

## Agenda en herhaling

Een afspraak blijft één bronrecord. De recurrence-service projecteert occurrences voor een begrensd bereik en ondersteunt dagelijks, werkdagen, wekelijks, tweewekelijks, maandelijks, jaarlijks en een eigen dag/week/maandinterval met optionele einddatum. Agendaweergaven vragen uitsluitend occurrences voor hun eigen zichtbare bereik op. Zo blijft de app ook met honderden afspraken snel.

## Herinneringen

De reminder-service controleert tijdens gebruik periodiek welke herinneringen verschuldigd zijn. Met toestemming gebruikt de app browsernotificaties; anders verschijnen blijvende waarschuwingen in de app. Service workers kunnen zonder externe pushserver niet gegarandeerd op een volledig gesloten apparaat wakker worden; dit wordt transparant in de instellingen uitgelegd.

## Gebruiksgemak en herstel

Een globale zoekservice leest alle actieve domeinrecords uitsluitend via repositories, normaliseert hoofdletters en accenten en levert begrensde, gesorteerde resultaten aan één zoekdialoog. Een vaste snelle-toevoegknop routeert naar de bestaande gevalideerde formulieren; er bestaat dus geen tweede schrijfpad.

De centrale prullenbak verzamelt soft-deleted records uit alle domeinrepositories en herstelt ze via de uniforme `restore()`-methode. De agenda behoudt daarnaast zijn eigen contextuele prullenbak. De datum van de laatste door de gebruiker gedownloade back-up is een kleine interfacevoorkeur in `localStorage` en wordt op dashboard en instellingen getoond; de back-upinhoud zelf blijft uit IndexedDB komen.

## Back-up en herstel

Export leest alle stores en maakt één versieerbaar JSON-bestand. Import valideert appnaam, schema-versie, verplichte secties en UUID's. Vóór iedere import wordt een volledige veiligheidskopie in `backups` opgeslagen. Vervangen wist pas na expliciete bevestiging de domeinstores; samenvoegen kiest per ID het record met de hoogste versie en daarna de nieuwste `updatedAt`. Geïmporteerde wijzigingen worden als lokaal/pending geregistreerd zodat een latere synchronisatielaag ze kan verwerken.

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

Fase 2 voegt een **losse sync-adapter** naast de bestaande repositories toe; views, services en lokale schema's blijven intact. Een gratis centrale database kan bijvoorbeeld zelf gehost worden of binnen een op dat moment passende gratis limiet draaien. De concrete aanbieder wordt pas in fase 2 gekozen, zodat fase 1 geen externe afhankelijkheid krijgt.

Het toekomstige model bevat een `familyId` op serverniveau en accounts voor Roy en Demy die lid zijn van één gezamenlijk gezinsaccount. Een eenmalige, kort geldige uitnodigingscode koppelt een tweede account/apparaat veilig aan het gezin. De beveiligde API bepaalt altijd op basis van de sessie tot welk gezin een record behoort; een client mag nooit zelf willekeurig `familyId` kiezen. Wachtwoorden worden alleen gehasht opgeslagen, sessies gebruiken korte toegangsduur plus veilige rotatie en alle communicatie loopt via HTTPS.

De sync-engine verwerkt de bestaande outbox:

1. bij openen van de app;
2. wanneer de app terug naar de voorgrond komt;
3. bij het `online`-event;
4. kort na iedere lokale wijziging, met debounce en retries.

Per wijziging stuurt de client record-ID, operatie, versie, wijzigingstijd en apparaat-ID. De server vergelijkt versies en een server-revisie. Onafhankelijke veldwijzigingen kunnen automatisch worden samengevoegd; gelijktijdige wijzigingen aan hetzelfde veld worden als conflict teruggegeven. Verwijdermarkeringen blijven tombstones. De client bewaart conflicten lokaal met `syncStatus: conflict` en toont een expliciete keuze tussen lokale, centrale of handmatig samengevoegde gegevens. Na serverbevestiging wordt een outbox-item `processed: true` en het record `synced`.

De API past autorisatie per gezin toe op iedere query en mutatie, gebruikt rate limiting, invoervalidatie, auditvelden, CSRF-bescherming waar van toepassing en intrekbare sessies. Gegevensscheiding wordt zowel in applicatielogica als databasebeleid afgedwongen. Uitnodigingscodes worden gehasht, verlopen snel en zijn eenmalig. Automatische synchronisatie wordt pas geactiveerd na expliciete aanmelding; de offline app blijft bruikbaar bij uitval van netwerk of server.

## Oplevervolgorde

1. database, schema, migraties en seeds;
2. repositories en outbox;
3. agenda en recurrence;
4. dashboard en overige domeinen;
5. back-up/import, instellingen en notificaties;
6. manifest/service worker;
7. automatische en visuele tests;
8. documentatie en eindcontrole op externe afhankelijkheden en onafgemaakte bediening.
