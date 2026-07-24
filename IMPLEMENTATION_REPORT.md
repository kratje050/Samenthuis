# Implementatierapport Samen Thuis 3.1.0

Datum: 24 juli 2026

## Resultaat

De bestaande PWA is uitgebreid zonder het bestaande authenticatie-, gezins-, IndexedDB- of synchronisatiesysteem te vervangen. De app blijft direct lokaal bruikbaar en de nieuwe records gebruiken dezelfde UUID-, versie-, soft-delete-, activiteit- en outboxketen als de bestaande onderdelen.

## Toegevoegde functies

- schema-gestuurde gezinsassistent met prikbord, inbox, kindprofielen, gezinsmodi, onderhoud, apparaten, opslaglocaties, lenen, cadeaukluis, afval, oppasmomenten, noodkaarten, abonnementen, spaardoelen, prijzen, bezoekplannen, beloningen, tijdlijn, bucketlist en klusprojecten;
- eigen uitvoerschermen voor dagelijks overzicht, vertrek, paklijsten, routines, restjes, besliswiel, oppasmodus en noodkaart;
- zoeken, type- en gezinslidfilters, kopiëren, archiveren, soft delete, herstel en conversies naar bestaande onderdelen;
- gekoppelde workflows voor bezoekboodschappen/-taken, klusmateriaal/-taken, apparatenonderhoud en bucketlist naar uitje of gezinsmoment;
- herhalende afvalmomenten, onderhoudsgeschiedenis, routinedaghistorie, spaardoeltransacties, prijsstatistiek en abonnementtotalen;
- automatische taakpunten op basis van geschatte tijd, lokale zwaarteherkenning en prioriteit, plus automatisch berekende routinepunten;
- een wekelijkse puntenstrijd voor gezinsleden op het dashboard, waarbij heropende taken weer van de actuele weekscore worden afgetrokken;
- een idempotente gezinsbibliotheek met 79 terugkerende taken, 12 taaksets met 126 ideeën, 8 routines en 36 uitdagingen;
- stabiele UUID’s voor alle starterrecords, zodat meerdere gezinsapparaten dezelfde starters synchroniseren zonder dubbele records;
- automatische uitdagingregels voor taakpunten, aantallen, categorieën, prioriteit, snelle klusjes en lokale trefwoorden;
- automatische terugboeking bij heropenen en wekelijkse of maandelijkse vernieuwing met behoud van maximaal twaalf vorige cyclussamenvattingen;
- onderdrukte meldingen voor uitsluitend de automatisch meegeleverde starters, zodat de eerste installatie geen meldingenstorm veroorzaakt;
- in-app- en echte achtergrondmeldingen voor afspraken, verjaardagen, taken, medicatie, dierenarts, voorraad, houdbaarheid, uitjes, afval, lenen, onderhoud, garanties, abonnementen, routines, oppas, meeneemlijsten en andere belangrijke gezinsmomenten;
- automatische pushinschrijving wanneer meldingen al waren toegestaan en later een gezinsaccount wordt gekoppeld;
- een vrijwillige meldingenpopup, duidelijke iPhone-installatievoorwaarden en een servergestuurde testmelding;
- maximaal tien lokale vorige versies, conflictdetectie met lokale en centrale inhoud en een handmatig conflictscherm;
- definitief verwijderen met een minimale sync-tombstone; automatische bewaartermijn staat standaard uit;
- lokale Blob-opslag, beeldcompressie, MIME- en groottecontrole en een private Supabase Storage-adapter;
- volledige back-up/import voor alle nieuwe records, geschiedenis, bestandsmetadata en Blob-inhoud;
- incrementele sync met begrensde pagina’s en een samengestelde `server_updated_at`/`record_id`-cursor;
- één gedeelde entiteitscatalogus voor venster- en service-workersynchronisatie.

## Database en migraties

IndexedDB is opgehoogd naar versie 4 met nieuwe stores:

- `assistantRecords`;
- `recordHistory`;
- `files`;
- `fileBlobs`.

De migratie [202607150001_assistant_modules.sql](./supabase/migrations/202607150001_assistant_modules.sql) breidt `family_records` niet-destructief uit, voegt de nieuwe entiteitstypen en cursorindex toe, vernieuwt `sync_family_record`, beveiligt verborgen cadeaus bij select en sync, maakt de private bucket `samen-thuis-private` en voegt gezinsgebonden Storage-policies toe. [202607150002_background_notifications.sql](./supabase/migrations/202607150002_background_notifications.sql) beheert de afgeschermde pushconfiguratie, apparaatinschrijvingen, bezorglog en minuutcron. Beide migraties zijn succesvol op productie toegepast.

## Beveiliging en privacy

- geen secret- of service-role key in de frontend;
- Supabase-responses worden niet door de app-shellcache opgeslagen;
- cadeau-uitsluiting wordt in RLS en de sync-RPC gecontroleerd;
- Storage-paden beginnen met een familie-ID en worden servermatig tegen het ingelogde lidmaatschap gecontroleerd;
- medische gegevens worden alleen weergegeven met een privacywaarschuwing en niet geïnterpreteerd;
- afbeeldingen maximaal 1600 pixels en maximaal 1 MB na compressie; documenten maximaal 5 MB;
- definitief verwijderen ruimt gekoppelde lokale bestanden op en plant online verwijdering wanneer het apparaat tijdelijk offline is.

## Bewust behouden

- vanilla HTML/CSS/JavaScript zonder framework of buildstap;
- bestaande Supabase Auth, gezinnen, uitnodigingscodes, `family_records`, Realtime en outbox;
- bestaande warme vormgeving, mobiele ondernavigatie en desktopzijmenu;
- bestaande Netlify-rootpublicatie;
- offline gebruik zonder verplicht account.

## Bekende platform- en uitvoeringsbeperkingen

- Background Sync blijft platformafhankelijk, maar herinneringen voor een gesloten app gebruiken nu servergestuurde Web Push en zijn daarvan niet afhankelijk;
- iPhone Web Push vereist iOS/iPadOS 16.4 of nieuwer en een PWA die via Safari op het beginscherm is geïnstalleerd;
- een live RLS/Storage-proef met drie gescheiden Supabase-testaccounts is niet uitgevoerd. De policies zijn statisch gecontroleerd en de productiemigraties zijn succesvol uitgevoerd;
- route- of kaartgegevens gebruiken bewust geen externe route-API; adressen blijven gewone tekst of een normale externe link;
- er zijn geen bank-, supermarkt-, afval- of AI-API’s toegevoegd.
