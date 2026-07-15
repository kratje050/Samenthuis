# Samen Thuis

Samen Thuis is een complete Nederlandstalige gezinsplanner voor Roy, Demy, Miley en Navy. De app combineert één gezamenlijke agenda met boodschappen, huishoudelijke taken, een maaltijdplanner, voorraad, uitgaven, huisdieren en uitjes.

Versie 1 werkt volledig lokaal en offline. Er is geen account, abonnement, advertentie, externe database, betaalde API of cloudverbinding nodig. Na de eerste online laadbeurt kan de PWA zonder internet worden geopend. Gegevens worden in deze fase **niet automatisch tussen telefoons gesynchroniseerd**.

## Mogelijkheden

- gezamenlijke gezinsagenda met dag-, week-, maand-, vandaag-, komende- en lijstweergave;
- herhalende afspraken, lokale herinneringen, zoeken, filters, kleuren, kopiëren, afronden, soft delete en herstel;
- boodschappenlijst met categorieën, winkels, sortering, afvinken en bulkverwijdering;
- herhalende huishoudelijke taken met historie en automatische volgende taak;
- weekplanner, recepten, favorieten en ingrediënten naar boodschappen;
- voorraadwaarschuwingen voor minimumaantal en houdbaarheid;
- handmatig uitgavenoverzicht per maand, categorie en gezinslid;
- huisdieren met medicatie, vaccinaties en dierenartsafspraken;
- uitjes, vakanties, favorieten en ideeën;
- zoeken vanuit ieder scherm over afspraken, boodschappen, taken, maaltijden, voorraad, uitgaven, huisdieren en uitjes;
- een vaste knop **Snel toevoegen** voor afspraken, boodschappen, taken, maaltijden en uitgaven;
- één centrale prullenbak in Instellingen om soft-deleted gegevens uit alle onderdelen te herstellen;
- een back-upstatus op het dashboard en in Instellingen, met een waarschuwing wanneer de laatste downloadbare back-up ouder wordt;
- aanpasbare gezinsleden, kleuren, profieliconen, categorieën en thema's;
- volledige JSON-back-up, gecontroleerde import, samenvoegen of vervangen;
- installeerbare PWA met lokale app-iconen, offline cache en updatecontrole.

## Snel lokaal starten

Deze map bevat gewone HTML, CSS en JavaScript; er is geen buildstap en er zijn geen runtimepakketten nodig.

### Makkelijkste manier op Windows

Dubbelklik op `START-SAMEN-THUIS.cmd`. De starter opent de app automatisch in de browser op `http://localhost:8080/`. Laat het geopende terminalvenster aanstaan tijdens het testen en druk daar op Enter om de server weer te stoppen.

### Handmatig starten

1. Open PowerShell of een terminal in de projectmap.
2. Start een eenvoudige lokale webserver, bijvoorbeeld met Python:

   ```powershell
   py -m http.server 8080
   ```

   Als `py` niet beschikbaar is:

   ```powershell
   python -m http.server 8080
   ```

3. Open `http://localhost:8080/` in een moderne browser.

Stop de server met `Ctrl+C`.

### Waarom niet via `file://`?

Open `index.html` niet rechtstreeks vanuit Verkenner. ES-modules, IndexedDB en vooral service workers vallen onder browserbeveiliging die een weborigin vereist. Via `file://` kunnen imports worden geblokkeerd en kan de PWA niet correct installeren of offline cachen. `localhost` geldt voor ontwikkeling als veilige origin.

## PWA installeren

1. Open de app via `localhost` of via een HTTPS-website.
2. Wacht tot de eerste laadbeurt gereed is.
3. Gebruik de installatieoptie van de browser, zoals **App installeren** of **Toevoegen aan beginscherm**. Wanneer de browser een installatieprompt aanbiedt, verschijnt die optie ook bij **Instellingen**.
4. Open de geïnstalleerde app daarna vanuit het startscherm of appmenu.

Bij een nieuwe appversie verschijnt bovenaan een melding met **Nu bijwerken**. De service worker gebruikt een versiegebonden cache, activeert de nieuwe versie bewust en verwijdert oude Samen Thuis-caches. Hierdoor blijft een oude cache niet ongemerkt actief.

## Waar staan de gegevens?

Alle belangrijke gegevens staan in IndexedDB van de browser, gekoppeld aan de exacte website-origin. Kleine interfacevoorkeuren, zoals de laatste route en het apparaat-ID, staan in `localStorage`.

Dit betekent:

- gegevens op `http://localhost:8080` zijn gescheiden van dezelfde app op een gepubliceerde HTTPS-website;
- een andere browser of telefoon heeft in fase 1 een eigen lokale dataset;
- privé- of incognitovensters kunnen gegevens na sluiten verwijderen;
- het wissen van sitegegevens, browsergegevens of IndexedDB kan alle lokale gezinsgegevens verwijderen;
- verwijderen en opnieuw installeren van de PWA kan per browser/platform eveneens gevolgen voor lokale opslag hebben.

Maak daarom regelmatig een back-up.

## Back-up maken

1. Open **Meer → Instellingen**.
2. Ga naar **Back-up en herstel**.
3. Kies **Back-up downloaden**.
4. Bewaar het JSON-bestand op een veilige plek, bij voorkeur ook buiten het apparaat.

Het bestand bevat app- en databaseversie, apparaat-ID, instellingen, gezinsleden, alle domeingegevens en de lokale outbox.

## Back-up terugzetten

1. Open **Meer → Instellingen → Back-up en herstel**.
2. Kies **Back-up kiezen** en selecteer een eerder geëxporteerd JSON-bestand.
3. Kies:
   - **Samenvoegen** om per ID de hoogste versie en daarna de nieuwste wijziging te behouden;
   - **Vervangen** om de huidige lokale gezinsgegevens na een extra bevestiging volledig door de back-up te vervangen.
4. Wacht tot de app opnieuw is geladen.

De import controleert JSON, appnaam, databaseversie, verplichte onderdelen en UUID's. Vóór iedere import wordt automatisch een lokale veiligheidskopie gemaakt. Deze kopie beschermt tegen een mislukte import, maar vervangt geen extern bewaard exportbestand.

## Gratis statisch publiceren

De app kan zonder servercode op iedere statische HTTPS-host worden geplaatst. Een concrete gratis route is GitHub Pages voor een openbaar repository onder GitHub Free:

1. plaats de volledige projectmap in de root van een openbaar GitHub-repository;
2. commit en push alle bestanden, inclusief `.nojekyll`;
3. open in het repository **Settings → Pages**;
4. kies bij de publicatiebron **Deploy from a branch**, selecteer de hoofdbranch en de map `/ (root)`;
5. open na de publicatie de getoonde HTTPS-URL en laad de app eenmaal volledig;
6. installeer de PWA eventueel opnieuw vanaf deze definitieve URL.

De app gebruikt relatieve paden en werkt daardoor ook onder een projectpad zoals `https://naam.github.io/samen-thuis/`. GitHub beschrijft Pages als hosting voor statische HTML-, CSS- en JavaScriptbestanden en vermeldt de actuele beschikbaarheid per abonnement in de [officiële GitHub Pages-documentatie](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Controleer vóór publicatie altijd de actuele voorwaarden. Let op: een openbare website maakt de appbestanden openbaar, maar niet de IndexedDB-gezinsgegevens; die blijven in de browser van het apparaat.

## Tests uitvoeren

Pure datum-, recurrence-, kalender- en back-upvalidatietests:

```powershell
npm test
```

Hiervoor is Node.js nodig, maar de app zelf heeft Node.js niet nodig.

Repository- en integratietests draaien in een echte browser-IndexedDB. Start de lokale server en open:

```text
http://localhost:8080/tests/test-runner.html
```

De browsertest gebruikt een unieke tijdelijke testdatabase en verwijdert die na afloop. De suite controleert onder andere CRUD en herstel, outbox, filters en zoeken, herhaling, maaltijdingrediënten, voorraad, uitgaven, back-up samenvoegen/vervangen, heropenen van IndexedDB en honderden records.

De globale zoekfunctie kan ook met `Ctrl+K` (Windows/Linux) of `⌘K` (macOS) worden geopend. Verwijderde gegevens uit ieder onderdeel staan bij **Meer → Instellingen → Centrale prullenbak**.

## Technische opzet

- HTML5, CSS3 en vanilla JavaScript ES-modules;
- IndexedDB met versieerbaar schema en migraties;
- repositories als enige schrijfroute voor gewone domeinmutaties;
- atomische outboxregistratie naast ieder gewijzigd record;
- UUID's, versies, apparaat-ID's, wijzigingstijden en synchronisatiestatus op ieder domeinrecord;
- hashrouter voor betrouwbare statische hosting en offline navigatie;
- service worker en webmanifest zonder externe runtime-assets;
- mobile-first ondernavigatie en een zijmenu vanaf tabletformaat.

De volledige architectuur en ontwerpkeuzes staan in [PLAN.md](./PLAN.md).

## Voorbereiding op fase 2

Online synchronisatie is bewust nog niet geïmplementeerd. De lokale opslagstructuur is er wel op voorbereid:

- ieder record heeft syncmetadata en een oplopende versie;
- iedere create, update en soft delete schrijft een outbox-item;
- views gebruiken services en repositories, niet rechtstreeks IndexedDB;
- een latere sync-adapter kan de outbox verwerken zonder de schermen of domeinopslag opnieuw te bouwen;
- tombstones (`deletedAt`) blijven beschikbaar voor synchronisatie van verwijderingen;
- conflicten kunnen later via `syncStatus: conflict` worden teruggekoppeld.

Het hoofdstuk **Fase 2: centrale database en automatische synchronisatie** in `PLAN.md` beschrijft accounts voor Roy en Demy, het gezamenlijke gezinsaccount, uitnodigingscodes, syncmomenten, conflictbehandeling, een beveiligde API, gegevensscheiding en sessie- en wachtwoordbeveiliging.

## Privacy en beperkingen van fase 1

- Er wordt niets naar een externe dienst gestuurd.
- Er is geen bankkoppeling en geen achtergrondtracking.
- Browsernotificaties werken alleen na toestemming.
- Zonder online pushdienst kan een browser die volledig is afgesloten niet op ieder platform betrouwbaar voor een afspraak worden gewekt; daarom toont de app verschuldigde herinneringen ook tijdens gebruik.
- Dezelfde gegevens verschijnen pas op meerdere telefoons nadat fase 2 met centrale synchronisatie is gebouwd.

## Licentie en kosten

Samen Thuis gebruikt geen betaalde diensten, abonnementen of externe runtimebibliotheken. De app kan lokaal en als statische website gratis worden gebruikt. Eventuele kosten voor een eigen domeinnaam zijn optioneel en staan los van de app.
