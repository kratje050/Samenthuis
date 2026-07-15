# Implementatierapport Samen Thuis 3.0.0

Datum: 15 juli 2026

## Resultaat

De bestaande PWA is uitgebreid zonder het bestaande authenticatie-, gezins-, IndexedDB- of synchronisatiesysteem te vervangen. De app blijft direct lokaal bruikbaar en de nieuwe records gebruiken dezelfde UUID-, versie-, soft-delete-, activiteit- en outboxketen als de bestaande onderdelen.

## Toegevoegde functies

- schema-gestuurde gezinsassistent met prikbord, inbox, kindprofielen, gezinsmodi, onderhoud, apparaten, opslaglocaties, lenen, cadeaukluis, afval, oppasmomenten, noodkaarten, abonnementen, spaardoelen, prijzen, bezoekplannen, beloningen, tijdlijn, bucketlist en klusprojecten;
- eigen uitvoerschermen voor dagelijks overzicht, vertrek, paklijsten, routines, restjes, besliswiel, oppasmodus en noodkaart;
- zoeken, type- en gezinslidfilters, kopiëren, archiveren, soft delete, herstel en conversies naar bestaande onderdelen;
- gekoppelde workflows voor bezoekboodschappen/-taken, klusmateriaal/-taken, apparatenonderhoud en bucketlist naar uitje of gezinsmoment;
- herhalende afvalmomenten, onderhoudsgeschiedenis, routinedaghistorie, spaardoeltransacties, prijsstatistiek en abonnementtotalen;
- in-app- en browserherinneringen voor agenda, afval, lenen, onderhoud, garanties, abonnementen, routines en bucketlist;
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

De migratie [202607150001_assistant_modules.sql](./supabase/migrations/202607150001_assistant_modules.sql) is toegevoegd. Ze breidt `family_records` niet-destructief uit, voegt de nieuwe entiteitstypen en cursorindex toe, vernieuwt `sync_family_record`, beveiligt verborgen cadeaus bij select en sync, maakt de private bucket `samen-thuis-private` en voegt gezinsgebonden Storage-policies toe. De RPC leidt het gezin uitsluitend af uit `auth.uid()`.

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

- browsers, met name iOS, garanderen geen exacte uitvoering van een volledig gesloten PWA. Background Sync, Periodic Background Sync, push en de open/online/voorgrondterugval zijn daarom best effort;
- de nieuwe productiemigratie is bewust niet automatisch op het echte Supabase-project uitgevoerd. De beheerder moet haar na back-up en test toepassen;
- een live RLS/Storage-proef met drie gescheiden Supabase-testaccounts is niet uitgevoerd, omdat in deze werkmap geen lokale Supabase CLI/Docker-omgeving of afgescheiden testaccounts beschikbaar waren. De policies zijn wel statisch gecontroleerd;
- route- of kaartgegevens gebruiken bewust geen externe route-API; adressen blijven gewone tekst of een normale externe link;
- er zijn geen bank-, supermarkt-, afval- of AI-API’s toegevoegd.
