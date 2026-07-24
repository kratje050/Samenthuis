# Testrapport Samen Thuis 3.1.0

Testdatum: 24 juli 2026
Testomgeving: Windows, lokale Python-webserver, ingebouwde Chromium-browser, Node.js

## Automatische controles

| Controle | Werkelijk resultaat |
|---|---|
| `npm test` | 90 geslaagd, 0 mislukt |
| `node --check` op alle JavaScriptbestanden | 133 bestanden syntactisch geldig |
| `/tests/test-runner.html` in Chromium | 105 geslaagd, 0 mislukt |
| `deno check supabase/functions/send-reminders/index.ts` | geslaagd |
| productie Edge Function | OPTIONS 200, gebruikersactie zonder sessie correct 401 |
| productie Supabase Cron | actief, iedere minuut; meerdere runs HTTP 200 met 2 actieve apparaatinschrijvingen |
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
- schone eerste installatie gecontroleerd: 79 taken, 12 taaksets, 8 routines en 36 uitdagingen zonder dubbele records;
- een taak van 5 punten afgerond en gecontroleerd dat meerdere passende uitdagingen automatisch opliepen;
- mobiele taken- en uitdagingenpagina gecontroleerd op 390 × 844 zonder horizontale overloop of starter-meldingenstorm;

## Gedekte logica

De tests dekken onder meer repositories, CRUD, soft delete/herstel, versiegeschiedenis, outbox, back-up/import, herhalingen, agendaweergaven, filters, synchronisatiecursor, Realtime-signaal, PWA-achtergrondsync, prijs- en abonnementberekeningen, spaardoelen, routines, automatische taak- en routinepunten, weekranglijsten, idempotente starterinhoud, automatische uitdagingregels en terugboekingen, paklijsten, restjesmatching, conflicten, bestandsvalidatie, onderhoud, afvalherhaling, beloningsgoedkeuring, herinneringen, manifest en app-shell.

De browserprestatietest bevat exact:

- 1.000 afspraken;
- 1.000 taken;
- 1.000 boodschappenitems;
- 500 prijsregistraties;
- 500 gezinsmomenten;
- 250 apparaten;
- 250 onderhoudstaken.

## Niet als live geslaagd geclaimd

De twee productiemigraties zijn via de Supabase SQL Editor succesvol uitgevoerd. De bijgewerkte Edge Function start, de minuutcron is actief en de laatste serverruns gaven HTTP 200 met twee actieve pushapparaten. Er is vanuit de gecontroleerde desktopbrowser bewust geen mobiele notificatietoestemming geaccepteerd. Een zichtbare echte apparaatmelding moet daarom nog één keer per Android/iPhone worden bevestigd met **Instellingen → Testmelding sturen**.

Een volledige drie-gebruikers-RLS/Storage-proef met gebruiker A en B in gezin 1 en gebruiker C in gezin 2 blijft een aparte beveiligingscontrole.

## Gevonden en herstelde fouten

- twee inline eventhandlers vervangen door normale eventlisteners;
- asynchrone knopfouten centraal afgevangen en als Nederlandse foutmelding getoond;
- ontbrekend offline cachebestand `finance-tools-service.js` toegevoegd;
- oude actieve service worker leverde tijdens de eerste browsertestrun twee oude filterfuncties; updatebanner geactiveerd en herhaling gaf 85/85;
- Nederlandse meervoudsvorm “weken” in herhaalparser hersteld;
- gekoppelde bestanden worden nu bij definitief verwijderen lokaal opgeruimd en online verwijderd of voor retry bewaard;
- cursorpaginering gebruikt nu tijd én record-ID om gelijktijdig bijgewerkte records niet over te slaan.
- een eerder toegestaan lokaal notificatierecht maakte na gezinskoppeling geen pushabonnement; dit wordt nu automatisch hersteld;
- de server controleerde alleen afspraken; belangrijke taken, huisdieren, voorraad en gezinsassistentonderdelen zijn toegevoegd;
- de Supabase-webeditor voegde tijdens de eerste functiondeploy broncode samen; de functie is opgeschoond, opnieuw gedeployd en daarna met opeenvolgende HTTP 200-cronruns gecontroleerd.
