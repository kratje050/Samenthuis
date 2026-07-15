# Samen Thuis

Samen Thuis is een complete Nederlandstalige gezinsplanner voor Roy, Demy, Miley en Navy. De app combineert één gezamenlijke agenda met boodschappen, huishoudelijke taken, een maaltijdplanner, voorraad, uitgaven, huisdieren en uitjes.

Versie 1.4 is offline-first: alle schermen blijven IndexedDB gebruiken en werken na de eerste laadbeurt zonder internet. Wie op meerdere telefoons dezelfde gezinsgegevens wil gebruiken kan optioneel een beveiligd gezinsaccount activeren. De outbox synchroniseert dan via Supabase zodra internet beschikbaar is, inclusief PWA-achtergrondtaken waar de browser die ondersteunt. Zonder account blijft de app volledig lokaal bruikbaar.

## Mogelijkheden

- gezamenlijke gezinsagenda met dag-, week-, maand-, vandaag-, komende- en lijstweergave;
- herhalende afspraken, lokale en optionele Web Push-herinneringen, zoeken, filters, kleuren, kopiëren, afronden, soft delete en herstel;
- agenda importeren en exporteren als standaard `.ics`-bestand voor onder meer Google Agenda, Apple Agenda en Outlook;
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
- gezinsactiviteit met wie wat heeft toegevoegd, aangepast of verwijderd;
- een begroeting zonder naam bij lokaal gebruik en met de eigen accountnaam na inloggen;
- herbruikbare boodschappen-, taken- en inpaklijsten via sjablonen;
- een back-upstatus op het dashboard en in Instellingen, met een waarschuwing wanneer de laatste downloadbare back-up ouder wordt;
- aanpasbare gezinsleden, kleuren, profieliconen, categorieën en thema's;
- volledige JSON-back-up, gecontroleerde import, samenvoegen of vervangen;
- installeerbare PWA met lokale app-iconen, offline cache, updatecontrole en best-effort achtergrondsynchronisatie;
- optionele e-mailaccounts, één gezamenlijk gezin, eenmalige uitnodigingscodes en automatische synchronisatie tussen telefoons;
- beveiligde centrale opslag met Row Level Security: een ingelogde gebruiker kan uitsluitend gegevens van het eigen gezin lezen.

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
3. Op Android of iPhone verschijnt automatisch één keer per browsersessie de keuze om Samen Thuis als app te gebruiken, zolang de app nog niet geïnstalleerd is.
4. Op Android start **Installeren** de installatieprompt van de browser. Als deze prompt niet beschikbaar is, toont de app de stappen via het browsermenu.
5. Op iPhone toont de app de Safari-stappen: **Delen → Zet op beginscherm → Voeg toe**. iOS staat niet toe dat een website deze bevestiging automatisch uitvoert.
6. De installatie-uitleg blijft altijd bereikbaar via **Meer → Instellingen → App installeren**.
7. Open de geïnstalleerde app daarna vanuit het startscherm of appmenu.

De installatiekeuze verschijnt niet wanneer Samen Thuis al in standalone-modus draait. Lokale PNG-iconen voor Android en `apple-touch-icon` voor iPhone zorgen dat het juiste apppictogram op het startscherm staat.

Bij een nieuwe appversie verschijnt bovenaan een melding met **Nu bijwerken**. De service worker gebruikt een versiegebonden cache, activeert de nieuwe versie bewust en verwijdert oude Samen Thuis-caches. Hierdoor blijft een oude cache niet ongemerkt actief.

## Waar staan de gegevens?

Alle belangrijke gegevens staan in IndexedDB van de browser, gekoppeld aan de exacte website-origin. Kleine interfacevoorkeuren, zoals de laatste route en het apparaat-ID, staan in `localStorage`.

Dit betekent:

- gegevens op `http://localhost:8080` zijn gescheiden van dezelfde app op een gepubliceerde HTTPS-website;
- een andere browser of telefoon heeft zonder gezinsaccount een eigen lokale dataset;
- na inloggen en koppelen aan hetzelfde gezin worden lokale wijzigingen automatisch samengevoegd met de centrale dataset;
- privé- of incognitovensters kunnen gegevens na sluiten verwijderen;
- het wissen van sitegegevens, browsergegevens of IndexedDB kan alle lokale gezinsgegevens verwijderen;
- verwijderen en opnieuw installeren van de PWA kan per browser/platform eveneens gevolgen voor lokale opslag hebben.

Maak daarom regelmatig een back-up.

## Gezinsaccount en synchronisatie

1. Open de app via `https://thuissamen.netlify.app`.
2. Tik op het wolkje bovenaan of open **Meer → Instellingen → Gezinsaccount en synchronisatie**.
3. Maak voor Roy het eerste account en bevestig zo nodig de e-mail.
4. Log in, kies **Nieuw gezin maken** en bewaar de getoonde uitnodigingscode.
5. Maak op de tweede telefoon een account voor Demy en kies **Met code aansluiten**.
6. Vanaf dat moment synchroniseert de app bij openen, terugkeren naar de voorgrond, internetherstel, kort na iedere wijziging en tijdens een actieve minuutcontrole. De geïnstalleerde PWA registreert daarnaast achtergrondtaken waar de browser dit toestaat.

Een uitnodigingscode is zeven dagen geldig en kan één keer worden gebruikt. Alleen de beheerder kan een nieuwe code maken; een nieuwe code maakt de vorige direct ongeldig. Wachtwoorden worden uitsluitend door Supabase Auth verwerkt en staan niet in de appdatabase. Toegangssessies staan lokaal in IndexedDB, niet in de back-up.

Bij netwerk- of Supabase-uitval blijft iedere handeling lokaal werken. Wachtende mutaties blijven in de outbox en worden later opnieuw aangeboden. Bij een gelijktijdige wijziging op twee telefoons detecteert de server het conflict en kiest hij deterministisch de hoogste versie en daarna de nieuwste wijzigingstijd.

### Achtergrondsynchronisatie van de PWA

- Na een lokale wijziging registreert de PWA een eenmalige Background Sync-herhaalpoging. Zo kan een wijziging alsnog worden verstuurd nadat internet terugkomt, ook wanneer het appvenster niet meer vooraan staat.
- Op browsers met Periodic Background Sync vraagt de PWA om ongeveer iedere vijftien minuten te mogen controleren. De browser bepaalt zelf het werkelijke moment op basis van installatie, gebruik, verbinding en batterijbesparing.
- Een ontvangen Web Push-bericht laat de service worker tevens een inhaalsync uitvoeren.
- Als deze browserfuncties ontbreken of worden tegengehouden, blijft de betrouwbare terugval actief: synchroniseren bij openen, voorgrond, focus, internetherstel en iedere wijziging. Zolang de app zichtbaar is controleert hij bovendien iedere minuut op wijzigingen van andere telefoons.

Een browser of besturingssysteem geeft websites nooit de garantie dat een volledig gesloten PWA op een exact tijdstip mag draaien. Vooral iOS kan achtergrondwerk sterk beperken. De app bewaart daarom iedere wijziging eerst atomisch in IndexedDB en de outbox; er gaat niets verloren en de eerstvolgende toegestane synchronisatie haalt alles in.

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

### Netlify en GitHub

Voor deze repository is geen buildcommando nodig. Gebruik op Netlify branch `main`, een lege base directory en publish directory `.`. `netlify.toml` legt deze instelling en de beveiligingsheaders vast. Iedere push naar `main` start automatisch een nieuwe Netlify-deployment.

### Supabase eenmalig inrichten

Het versiebeheer bevat [supabase/schema.sql](./supabase/schema.sql). Voer dit bestand één keer volledig uit in de SQL Editor van het gekozen Supabase-project. Het script maakt de tabellen, indexen, RLS-policies en uitsluitend voor ingelogde gebruikers beschikbare RPC-functies.

Stel daarna bij **Authentication → URL Configuration** de Site URL in op `https://thuissamen.netlify.app` en voeg die URL ook toe aan Redirect URLs. Voor lokaal testen kan `http://localhost:8080/**` als extra redirect worden toegevoegd. De website bevat alleen de openbare Supabase publishable key; plaats nooit een secret key of service-role key in HTML of JavaScript.

Voor meldingen terwijl de PWA gesloten is staat de Edge Function in `supabase/functions/send-reminders`. Implementeer die functie met JWT-controle uitgeschakeld zoals vastgelegd in `supabase/config.toml`; de functie controleert zelf gebruikerssessies en beveiligt de cronactie met een servercode. `schema.sql` activeert Supabase Cron en roept de functie iedere minuut aan. VAPID-sleutels worden bij het eerste gebruik binnen de Edge Function gegenereerd: de privésleutel blijft in een RLS-afgeschermde tabel en komt nooit in de browsercode terecht.

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

De browsertest gebruikt een unieke tijdelijke testdatabase en verwijdert die na afloop. De suite controleert onder andere CRUD en herstel, outbox, filters en zoeken, herhaling, maaltijdingrediënten, voorraad, uitgaven, back-up samenvoegen/vervangen, heropenen van IndexedDB, Background Sync-registratie en honderden records.

De globale zoekfunctie kan ook met `Ctrl+K` (Windows/Linux) of `⌘K` (macOS) worden geopend. Verwijderde gegevens uit ieder onderdeel staan bij **Meer → Instellingen → Centrale prullenbak**.

## Technische opzet

- HTML5, CSS3 en vanilla JavaScript ES-modules;
- IndexedDB met versieerbaar schema en migraties;
- repositories als enige schrijfroute voor gewone domeinmutaties;
- atomische outboxregistratie naast ieder gewijzigd record;
- een losse Supabase-adapter die de outbox verwerkt en centrale records zonder tweede lokale mutatie toepast;
- UUID's, versies, apparaat-ID's, wijzigingstijden en synchronisatiestatus op ieder domeinrecord;
- hashrouter voor betrouwbare statische hosting en offline navigatie;
- service worker en webmanifest zonder externe runtime-assets, met een zelfstandige IndexedDB/outbox-sync voor achtergrondtaken;
- mobile-first ondernavigatie en een zijmenu vanaf tabletformaat.

De volledige architectuur en ontwerpkeuzes staan in [PLAN.md](./PLAN.md).

## Fase 2 is geactiveerd

De centrale synchronisatielaag is toegevoegd zonder de schermen of lokale opslag opnieuw te bouwen. Ieder record behoudt UUID, versie, apparaat-ID, wijzigingstijd en soft-delete-tombstone. RPC-functies leiden het gezin altijd af uit de ingelogde sessie; de browser mag geen willekeurige `familyId` voor een mutatie kiezen. De app gebruikt geen geheime databasekey.

## Privacy en beperkingen

- Zonder gezinsaccount wordt niets naar Supabase gestuurd. Na expliciet inloggen worden gezinsrecords beveiligd centraal opgeslagen om meerdere telefoons te synchroniseren.
- Er is geen bankkoppeling en geen achtergrondtracking.
- Browsernotificaties werken alleen na toestemming.
- Met een gekoppeld gezinsaccount en notificatietoestemming kan Web Push de geïnstalleerde PWA ook buiten actief gebruik wekken. Platforminstellingen zoals batterijbesparing of uitgeschakelde notificaties kunnen bezorging nog steeds beperken; daarom blijven in-app herinneringen actief.
- Background Sync en Periodic Background Sync zijn best-effort browserfuncties. Als het platform ze niet aanbiedt, synchroniseert de app automatisch zodra hij weer wordt geopend, zichtbaar wordt of internet terugkomt.
- E-mailbevestiging en synchronisatie vereisen tijdelijk internet; alle gewone appfuncties blijven offline beschikbaar.

## Licentie en kosten

Samen Thuis gebruikt geen betaalde runtimebibliotheken. De app kan lokaal gratis worden gebruikt en de cloudkoppeling is ontworpen voor de gratis limieten van Netlify en Supabase. Wanneer een aanbieder zijn gratis limieten of voorwaarden wijzigt of wanneer het gezin die limieten overschrijdt, kan die dienst pauzeren; de lokale IndexedDB-versie blijft dan bruikbaar. Een eigen domeinnaam is optioneel.
