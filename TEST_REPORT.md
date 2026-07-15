# Testrapport Samen Thuis 3.0.0

Testdatum: 15 juli 2026  
Testomgeving: Windows, lokale Python-webserver, ingebouwde Chromium-browser, Node.js

## Automatische controles

| Controle | Werkelijk resultaat |
|---|---|
| `npm test` | 74 geslaagd, 0 mislukt |
| `node --check` op alle JavaScriptbestanden | 127 bestanden syntactisch geldig |
| `/tests/test-runner.html` in Chromium | 91 geslaagd, 0 mislukt |
| statische PWA-controle | manifest, iconen en ieder app-shellbestand aanwezig |
| statische beveiligingscontrole | geen inline `onclick`, geen service-roleverwijzing, cadeau- en Storage-policies aanwezig |
| `git diff --check` | geen patchfouten; alleen verwachte Windows LF/CRLF-waarschuwingen |

## Werkelijk uitgevoerde browsertests

- alle 23 hoofdschermen geopend op 1440 × 900 zonder routefoutscherm;
- alle 23 assistentmodules geopend op 390 × 844, ieder met een bruikbare toevoegactie;
- prikbordbericht gemaakt, aangepast, met bevestiging soft-deleted, hersteld en daarna definitief verwijderd;
- lang kindprofielformulier visueel gecontroleerd op 390 × 844;
- navigatie en inhoud gecontroleerd op 360 × 800, 390 × 844, 412 × 915, 768 × 1024, 1024 × 768 en 1440 × 900;
- service-worker-updatebanner gebruikt om een wachtende versie bewust te activeren;
- lokale webserver volledig gestopt en `#home` daarna opnieuw geopend: de PWA startte volledig uit de offline cache;
- server na de offlineproef opnieuw gestart.

## Gedekte logica

De tests dekken onder meer repositories, CRUD, soft delete/herstel, versiegeschiedenis, outbox, back-up/import, herhalingen, agendaweergaven, filters, synchronisatiecursor, Realtime-signaal, PWA-achtergrondsync, prijs- en abonnementberekeningen, spaardoelen, routines, paklijsten, restjesmatching, conflicten, bestandsvalidatie, onderhoud, afvalherhaling, beloningsgoedkeuring, herinneringen, manifest en app-shell.

De browserprestatietest bevat exact:

- 1.000 afspraken;
- 1.000 taken;
- 1.000 boodschappenitems;
- 500 prijsregistraties;
- 500 gezinsmomenten;
- 250 apparaten;
- 250 onderhoudstaken.

## Niet als live geslaagd geclaimd

`supabase --version` gaf aan dat de Supabase CLI niet is geïnstalleerd. Daarom zijn de migratie en RLS/Storage-policies niet tegen een lokale Supabase/Postgres-runtime uitgevoerd. Ook is geen productieomgeving met drie echte testgebruikers gemuteerd. De SQL is statisch gecontroleerd op idempotente toevoegingen, eigen-gezincontrole, cadeau-uitsluiting, private bucket, Storage-policies en het ontbreken van RLS-uitschakeling.

Na het toepassen van de migratie in een afgescheiden Supabase-testproject moeten aanvullend gebruiker A en B in gezin 1 en gebruiker C in gezin 2 worden getest, inclusief cadeau-uitsluiting, bestandsdownload, aangepaste `family_id`-requests en realtime pull. Pas daarna mag die specifieke live databasecontrole als geslaagd worden gemarkeerd.

## Gevonden en herstelde fouten

- twee inline eventhandlers vervangen door normale eventlisteners;
- asynchrone knopfouten centraal afgevangen en als Nederlandse foutmelding getoond;
- ontbrekend offline cachebestand `finance-tools-service.js` toegevoegd;
- oude actieve service worker leverde tijdens de eerste browsertestrun twee oude filterfuncties; updatebanner geactiveerd en herhaling gaf 85/85;
- Nederlandse meervoudsvorm “weken” in herhaalparser hersteld;
- gekoppelde bestanden worden nu bij definitief verwijderen lokaal opgeruimd en online verwijderd of voor retry bewaard;
- cursorpaginering gebruikt nu tijd én record-ID om gelijktijdig bijgewerkte records niet over te slaan.
