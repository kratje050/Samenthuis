const field = (name, label, type = 'text', options = {}) => ({ name, label, type, ...options });
const status = (...values) => values.map(([value, label]) => ({ value, label }));

const commonStatus = status(['active', 'Actief'], ['archived', 'Gearchiveerd']);
const planStatus = status(['idea', 'Idee'], ['planned', 'Gepland'], ['active', 'Bezig'], ['done', 'Afgerond'], ['archived', 'Gearchiveerd']);

export const ASSISTANT_MODULES = Object.freeze({
  notice: {
    title: 'Gezinsprikbord', singular: 'prikbordbericht', group: 'Gezin', icon: 'activity',
    description: 'Korte berichten en belangrijke mededelingen voor het gezin.', titleField: 'title', dateField: 'expiryDate',
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('message', 'Bericht', 'textarea', { wide: true, required: true }),
      field('memberIds', 'Voor gezinsleden', 'members', { wide: true }), field('important', 'Belangrijk', 'checkbox'),
      field('pinned', 'Vastzetten', 'checkbox'), field('readBy', 'Gelezen door', 'members', { wide: true }),
      field('expiryDate', 'Vervaldatum', 'date'), field('link', 'Link', 'url', { wide: true }),
      field('imageFileId', 'Afbeelding', 'image', { wide: true }), field('status', 'Status', 'select', { options: commonStatus, default: 'active' }),
      field('sortPosition', 'Sorteerpositie', 'number', { min: 0, step: 1, default: 0 })
    ], conversions: ['appointment', 'task', 'shopping']
  },
  inbox: {
    title: 'Gezinsinbox', singular: 'inbox-item', group: 'Gezin', icon: 'activity',
    description: 'Leg snel iets vast en werk het later rustig uit.', titleField: 'title', dateField: 'createdAt',
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('itemType', 'Soort', 'select', { default: 'note', options: status(['note','Notitie'],['idea','Idee'],['link','Link'],['image','Afbeelding'],['gift','Cadeautip'],['shopping','Losse boodschap'],['appointment','Afspraakidee'],['task','Taakidee'],['recipe','Receptidee'],['outing','Uitje']) }),
      field('content', 'Inhoud', 'textarea', { wide: true }), field('link', 'Link', 'url', { wide: true }),
      field('memberIds', 'Gezinsleden', 'members', { wide: true }), field('imageFileId', 'Afbeelding', 'image', { wide: true }),
      field('processed', 'Verwerkt', 'checkbox'), field('status', 'Status', 'select', { options: commonStatus, default: 'active' })
    ], conversions: ['appointment', 'task', 'shopping', 'outing', 'notice', 'gift', 'recipe', 'child_note']
  },
  packing: {
    title: 'Paklijsten', singular: 'paklijst', group: 'Plannen', icon: 'templates',
    description: 'Complete meeneemlijsten voor afspraken, uitjes en vakanties.', titleField: 'title', dateField: 'date',
    fields: [
      field('title', 'Naam van de lijst', 'text', { required: true }), field('packingType', 'Soort', 'select', { options: ['Vakantie','Weekend weg','Dagje uit','Zwemmen','Strand','Dierentuin','Logeren','Ziekenhuis','Arts','Fotoshoot','Familiebezoek','Uitje met kinderen'] }),
      field('date', 'Datum', 'date'), field('appointmentId', 'Gekoppelde afspraak-ID', 'text'),
      field('categories', 'Categorieën', 'lines', { wide: true }), field('items', 'Items', 'checklist', { wide: true, required: true }),
      field('notes', 'Notities', 'textarea', { wide: true }), field('essentialOnly', 'Toon alleen ontbrekende essentiële items', 'checkbox'),
      field('status', 'Status', 'select', { options: planStatus, default: 'active' })
    ]
  },
  child: {
    title: 'Kindprofielen', singular: 'kindprofiel', group: 'Gezin', icon: 'home',
    description: 'Maten, school, mijlpalen en belangrijke kindinformatie bij één gezinslid.', titleField: 'name', dateField: 'birthDate', privacy: true,
    fields: [
      field('memberId', 'Gezinslid', 'member', { required: true }), field('name', 'Naam', 'text', { required: true }),
      field('photoFileId', 'Profielfoto', 'image'), field('birthDate', 'Geboortedatum', 'date'),
      field('clothingSize', 'Kledingmaat'), field('shoeSize', 'Schoenmaat'), field('trouserSize', 'Broekmaat'), field('coatSize', 'Jasmaat'),
      field('school', 'Opvang of school'), field('schoolGroup', 'Groep'), field('contacts', 'Contactpersonen', 'lines', { wide: true }),
      field('importantItems', 'Belangrijke spullen', 'lines', { wide: true }), field('favorites', 'Favorieten', 'lines', { wide: true }),
      field('giftIdeas', 'Cadeautips', 'lines', { wide: true }), field('allergies', 'Allergieën', 'lines', { wide: true, sensitive: true }),
      field('medication', 'Medicatie', 'lines', { wide: true, sensitive: true }),
      field('clothingSizeHistory', 'Geschiedenis kledingmaten', 'lines', { wide: true }),
      field('shoeSizeHistory', 'Geschiedenis schoenmaten', 'lines', { wide: true }),
      field('sizeHistory', 'Overige maatgeschiedenis', 'lines', { wide: true }),
      field('milestones', 'Mijlpalen', 'lines', { wide: true }), field('neededItems', 'Benodigde kleding of spullen', 'lines', { wide: true }),
      field('birthdayWishes', 'Verjaardagswensen', 'lines', { wide: true }), field('notes', 'Notities', 'textarea', { wide: true })
    ]
  },
  routine: {
    title: 'Routines', singular: 'routine', group: 'Vandaag', icon: 'tasks',
    description: 'Herbruikbare ochtend-, avond- en gezinsroutines.', titleField: 'title', dateField: 'startDate',
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('memberId', 'Gezinslid', 'member'),
      field('days', 'Dagen van de week', 'weekdays', { wide: true, required: true }), field('startTime', 'Begintijd', 'time'),
      field('items', 'Checklist', 'checklist', { wide: true, required: true }), field('startDate', 'Startdatum', 'date'),
      field('endDate', 'Einddatum', 'date'), field('paused', 'Tijdelijk gepauzeerd', 'checkbox'),
      field('status', 'Status', 'select', { options: status(['active','Actief'],['paused','Gepauzeerd'],['archived','Gearchiveerd']), default: 'active' })
    ]
  },
  family_mode: {
    title: 'Gezinsmodi', singular: 'gezinsmodus', group: 'Vandaag', icon: 'home',
    description: 'Bepaal welke informatie op een bepaald soort dag voorrang krijgt.', titleField: 'title',
    fields: [
      field('title', 'Naam', 'text', { required: true }), field('modeType', 'Modus', 'select', { options: ['Normale dag','Werkdag','Fotoshootdag','Zieke-kind-dag','Uitjesdag','Vakantiemodus','Rustige dag','Oppasmodus'] }),
      field('visibleCards', 'Zichtbare dashboardkaarten', 'lines', { wide: true }), field('priorityRules', 'Prioriteit van taken', 'textarea', { wide: true }),
      field('activeRoutineIds', 'Actieve routine-ID’s', 'lines', { wide: true }), field('prominentReminders', 'Prominente herinneringen', 'lines', { wide: true }),
      field('quickActions', 'Snelle acties', 'lines', { wide: true }), field('hiddenInformation', 'Tijdelijk verborgen informatie', 'lines', { wide: true }),
      field('active', 'Nu actief', 'checkbox')
    ]
  },
  maintenance: {
    title: 'Huisonderhoud', singular: 'onderhoudstaak', group: 'Thuis', icon: 'inventory',
    description: 'Plan onderhoud aan woning, tuin, vervoer, apparaten en veiligheid.', titleField: 'title', dateField: 'nextDate',
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('description', 'Omschrijving', 'textarea', { wide: true }),
      field('category', 'Categorie', 'select', { options: ['Keuken','Badkamer','Woonkamer','Slaapkamer','Tuin','Auto','Fiets','Verwarming','Ventilatie','Elektrische apparaten','Veiligheid','Overig'] }),
      field('location', 'Locatie'), field('assignedTo', 'Toegewezen aan', 'member'), field('lastDate', 'Laatste uitvoering', 'date'),
      field('nextDate', 'Volgende uitvoering', 'date'), field('recurrence', 'Herhaalpatroon'),
      field('estimatedCost', 'Geschatte kosten', 'number', { min: 0, step: 0.01 }), field('actualCost', 'Werkelijke kosten', 'number', { min: 0, step: 0.01 }),
      field('history', 'Onderhoudsgeschiedenis', 'lines', { wide: true }), field('imageFileId', 'Afbeelding', 'image'), field('attachmentFileId', 'Bijlage', 'file'),
      field('notes', 'Notities', 'textarea', { wide: true }), field('status', 'Status', 'select', { options: planStatus, default: 'planned' })
    ]
  },
  appliance: {
    title: 'Apparaten en garantie', singular: 'apparaat', group: 'Thuis', icon: 'inventory',
    description: 'Bewaar aankoop-, garantie-, reparatie- en handleidinggegevens.', titleField: 'name', dateField: 'warrantyExpiry',
    fields: [
      field('name', 'Apparaatnaam', 'text', { required: true }), field('category', 'Categorie'), field('brand', 'Merk'), field('model', 'Model'),
      field('serialNumber', 'Serienummer'), field('purchaseDate', 'Aankoopdatum', 'date'), field('purchasePrice', 'Aankoopprijs', 'number', { min: 0, step: 0.01 }),
      field('store', 'Winkel'), field('warrantyMonths', 'Garantie in maanden', 'number', { min: 0, step: 1 }), field('warrantyExpiry', 'Garantie vervalt', 'date'),
      field('photoFileId', 'Foto', 'image'), field('receiptFileId', 'Kassabon', 'file'), field('manualFileId', 'Handleiding', 'file'),
      field('repairs', 'Reparatiegeschiedenis', 'lines', { wide: true }), field('maintenanceId', 'Gekoppeld onderhoud-ID'),
      field('storageLocation', 'Opslaglocatie'), field('notes', 'Notities', 'textarea', { wide: true }),
      field('status', 'Status', 'select', { options: status(['active','In gebruik'],['sold','Verkocht'],['discarded','Weggegooid'],['replaced','Vervangen'],['archived','Gearchiveerd']), default: 'active' })
    ]
  },
  storage_location: {
    title: 'Wat ligt waar?', singular: 'voorwerp', group: 'Thuis', icon: 'search',
    description: 'Vind spullen terug per kamer, kast, plank, lade of bak.', titleField: 'item', dateField: 'lastSeenAt',
    fields: [
      field('item', 'Voorwerp', 'text', { required: true }), field('category', 'Categorie'), field('room', 'Kamer'), field('cupboard', 'Kast'),
      field('shelf', 'Plank'), field('drawer', 'Lade'), field('box', 'Bak'), field('exactLocation', 'Exacte omschrijving', 'textarea', { wide: true }),
      field('photoFileId', 'Foto', 'image'), field('quantity', 'Hoeveelheid', 'number', { min: 0, step: 1 }),
      field('temporarilyMoved', 'Tijdelijk verplaatst', 'checkbox'), field('temporaryLocation', 'Tijdelijke locatie'), field('lastSeenAt', 'Laatst gezien', 'date'),
      field('searchCount', 'Aantal keer gezocht', 'number', { min: 0, step: 1, default: 0 }), field('notes', 'Notitie', 'textarea', { wide: true })
    ]
  },
  loan: {
    title: 'Leenlijst', singular: 'geleend voorwerp', group: 'Thuis', icon: 'activity',
    description: 'Houd bij wat geleend, uitgeleend, te laat of teruggebracht is.', titleField: 'item', dateField: 'expectedReturnDate',
    fields: [
      field('item', 'Voorwerp', 'text', { required: true }), field('person', 'Persoon', 'text', { required: true }),
      field('loanType', 'Type', 'select', { options: status(['borrowed','Geleend'],['lent','Uitgeleend']) }), field('date', 'Datum', 'date'),
      field('expectedReturnDate', 'Verwachte retourdatum', 'date'), field('actualReturnDate', 'Werkelijke retourdatum', 'date'),
      field('photoFileId', 'Foto', 'image'), field('reminder', 'Herinnering', 'date'), field('notes', 'Notitie', 'textarea', { wide: true }),
      field('status', 'Status', 'select', { options: status(['open','Open'],['returned','Teruggebracht'],['archived','Gearchiveerd']), default: 'open' })
    ]
  },
  gift: {
    title: 'Cadeaukluis', singular: 'cadeau-idee', group: 'Geld', icon: 'birthday',
    description: 'Bewaar cadeau-ideeën en verberg ze servermatig voor geselecteerde accounts.', titleField: 'idea', dateField: 'date', privacy: true,
    fields: [
      field('recipient', 'Ontvanger', 'text', { required: true }), field('idea', 'Cadeau-idee', 'text', { required: true }),
      field('occasion', 'Gelegenheid'), field('date', 'Datum', 'date'), field('price', 'Prijs', 'number', { min: 0, step: 0.01 }),
      field('budget', 'Budget', 'number', { min: 0, step: 0.01 }), field('store', 'Winkel'), field('link', 'Link', 'url', { wide: true }),
      field('imageFileId', 'Afbeelding', 'image'), field('purchased', 'Gekocht', 'checkbox'), field('wrapped', 'Ingepakt', 'checkbox'),
      field('given', 'Gegeven', 'checkbox'), field('hiddenForUserIds', 'Verbergen voor accounts', 'cloudMembers', { wide: true }),
      field('notes', 'Notities', 'textarea', { wide: true }), field('status', 'Status', 'select', { options: commonStatus, default: 'active' })
    ]
  },
  waste: {
    title: 'Afvalkalender', singular: 'afvalmoment', group: 'Thuis', icon: 'calendar',
    description: 'Handmatige ophaaldagen, afwijkingen en containermeldingen.', titleField: 'wasteType', dateField: 'date',
    fields: [
      field('wasteType', 'Afvalsoort', 'select', { options: ['Restafval','GFT','Papier','PMD','Glas','Grofvuil','Overig'], required: true }),
      field('customType', 'Eigen afvalsoort'), field('date', 'Ophaaldatum', 'date', { required: true }), field('recurrence', 'Herhaling'),
      field('reminderTime', 'Herinnering de avond ervoor', 'time', { default: '20:00' }), field('putOutside', 'Container buitengezet', 'checkbox'),
      field('broughtInside', 'Container terug binnen', 'checkbox'), field('source', 'Bron', 'select', { options: status(['manual','Handmatig'],['external','Externe bron']), default: 'manual' }),
      field('notes', 'Notities', 'textarea', { wide: true })
    ]
  },
  babysitting: {
    title: 'Oppasmomenten', singular: 'oppasmoment', group: 'Gezin', icon: 'home',
    description: 'Een rustige, afgeschermde selectie met informatie voor de oppas.', titleField: 'title', dateField: 'startAt', privacy: true,
    fields: [
      field('title', 'Naam van het oppasmoment', 'text', { required: true }), field('startAt', 'Begintijd', 'datetime-local', { required: true }),
      field('endAt', 'Eindtijd', 'datetime-local', { required: true }), field('childMemberIds', 'Kinderen', 'members', { wide: true }),
      field('schedule', 'Planning', 'textarea', { wide: true }), field('bedtimes', 'Bedtijden', 'lines', { wide: true }),
      field('food', 'Eten en drinken', 'textarea', { wide: true }), field('allergies', 'Allergieën', 'textarea', { wide: true, sensitive: true }),
      field('medication', 'Medicatie-instructies', 'textarea', { wide: true, sensitive: true }), field('emergencyContacts', 'Noodcontacten', 'lines', { wide: true }),
      field('houseRules', 'Huisregels', 'textarea', { wide: true }), field('locations', 'Waar spullen liggen', 'lines', { wide: true }),
      field('phoneNumbers', 'Telefoonnummers', 'lines', { wide: true }), field('notes', 'Belangrijke notities', 'textarea', { wide: true }),
      field('exitPinHash', 'Lokale afsluitpincode', 'pin'), field('active', 'Oppasmodus actief', 'checkbox')
    ]
  },
  emergency: {
    title: 'Noodkaarten', singular: 'noodkaart', group: 'Gezin', icon: 'settings',
    description: 'Volledig offline noodinformatie per gezinslid of voor het hele gezin.', titleField: 'title', dateField: 'lastCheckedAt', privacy: true,
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('memberId', 'Gezinslid', 'member'), field('emergencyContacts', 'Noodcontacten', 'lines', { wide: true }),
      field('generalPractitioner', 'Huisarts'), field('dentist', 'Tandarts'), field('vet', 'Dierenarts'), field('addresses', 'Belangrijke adressen', 'lines', { wide: true }),
      field('licensePlate', 'Kenteken'), field('insurance', 'Verzekeringsinformatie', 'textarea', { wide: true }),
      field('allergies', 'Allergieën', 'textarea', { wide: true, sensitive: true }), field('medication', 'Medicatie', 'textarea', { wide: true, sensitive: true }),
      field('instructions', 'Aanvullende instructies', 'textarea', { wide: true }), field('lastCheckedAt', 'Laatst gecontroleerd', 'date', { required: true })
    ]
  },
  subscription: {
    title: 'Vaste lasten en abonnementen', singular: 'abonnement', group: 'Geld', icon: 'expenses',
    description: 'Maandlasten, incasso’s, proefperiodes en contracteinden zonder bankkoppeling.', titleField: 'name', dateField: 'contractEndDate',
    fields: [
      field('name', 'Naam', 'text', { required: true }), field('category', 'Categorie'), field('provider', 'Aanbieder'),
      field('amount', 'Bedrag', 'number', { required: true, min: 0, step: 0.01 }), field('frequency', 'Betaalfrequentie', 'select', { options: status(['monthly','Maandelijks'],['quarterly','Per kwartaal'],['yearly','Jaarlijks'],['weekly','Wekelijks']) }),
      field('debitDay', 'Incassodag', 'number', { min: 1, step: 1 }), field('startDate', 'Startdatum', 'date'), field('contractEndDate', 'Contracteinddatum', 'date'),
      field('noticePeriod', 'Opzegtermijn'), field('trialEndDate', 'Einde proefperiode', 'date'), field('expectedPriceChange', 'Verwachte prijswijziging', 'number', { step: 0.01 }),
      field('paidBy', 'Betaald door', 'member'), field('notes', 'Notitie', 'textarea', { wide: true }), field('status', 'Status', 'select', { options: status(['active','Actief'],['ended','Beëindigd']), default: 'active' })
    ]
  },
  savings_goal: {
    title: 'Spaardoelen', singular: 'spaardoel', group: 'Geld', icon: 'expenses',
    description: 'Gezamenlijke en persoonlijke doelen met handmatige stortingen.', titleField: 'name', dateField: 'targetDate',
    fields: [
      field('name', 'Naam', 'text', { required: true }), field('targetAmount', 'Doelbedrag', 'number', { required: true, min: 0, step: 0.01 }),
      field('currentAmount', 'Huidig bedrag', 'number', { min: 0, step: 0.01, default: 0 }), field('targetDate', 'Streefdatum', 'date'),
      field('category', 'Categorie'), field('memberIds', 'Gezinsleden', 'members', { wide: true }), field('imageFileId', 'Afbeelding', 'image'),
      field('transactions', 'Transactiegeschiedenis', 'transactions', { wide: true }), field('milestones', 'Mijlpalen', 'lines', { wide: true }),
      field('notes', 'Notitie', 'textarea', { wide: true }), field('status', 'Status', 'select', { options: status(['active','Actief'],['achieved','Behaald'],['archived','Gearchiveerd']), default: 'active' })
    ]
  },
  price_history: {
    title: 'Prijsgeheugen', singular: 'prijsregistratie', group: 'Geld', icon: 'cart',
    description: 'Vergelijk zelf geregistreerde prijzen en eenheidsprijzen per winkel.', titleField: 'productName', dateField: 'date',
    fields: [
      field('productName', 'Productnaam', 'text', { required: true }), field('shoppingProductId', 'Gekoppeld boodschappenproduct-ID'),
      field('store', 'Winkel', 'text', { required: true }), field('brand', 'Merk'), field('quantity', 'Hoeveelheid', 'number', { required: true, min: 0.001, step: 0.001 }),
      field('unit', 'Eenheid'), field('price', 'Prijs', 'number', { required: true, min: 0, step: 0.01 }), field('unitPrice', 'Eenheidsprijs', 'number', { min: 0, step: 0.001, readonly: true }),
      field('date', 'Datum', 'date', { required: true }), field('offer', 'Aanbieding', 'checkbox'), field('notes', 'Notitie', 'textarea', { wide: true })
    ]
  },
  visit_plan: {
    title: 'Bezoek- en feestplanner', singular: 'bezoekplan', group: 'Plannen', icon: 'birthday',
    description: 'Plan gasten, eten, taken, boodschappen en kosten voor een bijeenkomst.', titleField: 'title', dateField: 'date',
    fields: [
      field('title', 'Naam', 'text', { required: true }), field('eventType', 'Soort', 'select', { options: ['Verjaardag','Visite','Familiefeest','Barbecue','Kinderfeest','Andere bijeenkomst'] }),
      field('date', 'Datum', 'date', { required: true }), field('time', 'Tijd', 'time'), field('location', 'Locatie'),
      field('guests', 'Gastenlijst', 'guestList', { wide: true }), field('adults', 'Aantal volwassenen', 'number', { min: 0, step: 1 }), field('children', 'Aantal kinderen', 'number', { min: 0, step: 1 }),
      field('planning', 'Planning', 'textarea', { wide: true }), field('foodAndDrink', 'Eten en drinken', 'lines', { wide: true }),
      field('shoppingIds', 'Gekoppelde boodschappen-ID’s', 'lines', { wide: true }), field('taskIds', 'Gekoppelde taak-ID’s', 'lines', { wide: true }),
      field('costs', 'Kosten', 'number', { min: 0, step: 0.01 }), field('giftWishes', 'Cadeauwensen', 'lines', { wide: true }),
      field('cleanupChecklist', 'Opruimchecklist', 'checklist', { wide: true }), field('notes', 'Notities', 'textarea', { wide: true }),
      field('status', 'Status', 'select', { options: planStatus, default: 'planned' })
    ]
  },
  decision_wheel: {
    title: 'Besliswiel', singular: 'besliswiel', group: 'Plannen', icon: 'theme',
    description: 'Kies speels en eerlijk uit maaltijden, films, uitjes, taken of eigen opties.', titleField: 'title',
    fields: [
      field('title', 'Naam', 'text', { required: true }), field('wheelType', 'Categorie', 'select', { options: ['Wat eten we','Welke film kijken we','Welk uitje','Wie doet de taak','Eigen keuzes'] }),
      field('choices', 'Keuzes', 'choices', { wide: true, required: true }), field('results', 'Eerdere uitslagen', 'lines', { wide: true }),
      field('status', 'Status', 'select', { options: commonStatus, default: 'active' })
    ]
  },
  reward: {
    title: 'Beloningen en uitdagingen', singular: 'beloning of uitdaging', group: 'Gezin', icon: 'tasks',
    description: 'Een optioneel positief systeem met punten, weekdoelen en gezinsuitdagingen.', titleField: 'title', dateField: 'endDate',
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('rewardType', 'Soort', 'select', { options: status(['reward','Beloning'],['challenge','Uitdaging'],['badge','Badge'],['saving_card','Spaarkaart']) }),
      field('memberIds', 'Gezinsleden', 'members', { wide: true }), field('points', 'Punten', 'number', { min: 0, step: 1 }),
      field('goal', 'Doel', 'number', { min: 0, step: 1 }), field('progress', 'Voortgang', 'number', { min: 0, step: 1 }),
      field('startDate', 'Startdatum', 'date'), field('endDate', 'Einddatum', 'date'), field('approvalRequired', 'Goedkeuring door volwassene nodig', 'checkbox'),
      field('approvedBy', 'Goedgekeurd door', 'member'), field('notes', 'Notities', 'textarea', { wide: true }),
      field('status', 'Status', 'select', { options: status(['active','Actief'],['achieved','Behaald'],['paused','Gepauzeerd'],['archived','Gearchiveerd']), default: 'active' })
    ]
  },
  family_memory: {
    title: 'Gezinstijdlijn', singular: 'gezinsmoment', group: 'Gezin', icon: 'activity',
    description: 'Een compact gezinsdagboek met gecomprimeerde foto’s en favorieten.', titleField: 'title', dateField: 'date',
    fields: [
      field('date', 'Datum', 'date', { required: true }), field('title', 'Titel', 'text', { required: true }), field('text', 'Korte tekst', 'textarea', { wide: true }),
      field('photoFileId', 'Foto', 'image'), field('memberIds', 'Gezinsleden', 'members', { wide: true }), field('category', 'Categorie'),
      field('favorite', 'Favoriet', 'checkbox'), field('location', 'Locatie'), field('status', 'Status', 'select', { options: commonStatus, default: 'active' })
    ]
  },
  bucket_list: {
    title: 'Gezinsbucketlist', singular: 'bucketlistidee', group: 'Plannen', icon: 'outings',
    description: 'Bewaar gezinsdromen en zet ze later om naar een concreet uitje.', titleField: 'activity', dateField: 'completedDate',
    fields: [
      field('activity', 'Activiteit', 'text', { required: true }), field('location', 'Locatie'), field('estimatedCost', 'Geschatte kosten', 'number', { min: 0, step: 0.01 }),
      field('bestSeason', 'Beste seizoen'), field('ageSuitability', 'Leeftijdsgeschiktheid'), field('memberIds', 'Gezinsleden', 'members', { wide: true }),
      field('favorite', 'Favoriet', 'checkbox'), field('planned', 'Gepland', 'checkbox'), field('completed', 'Afgerond', 'checkbox'),
      field('completedDate', 'Datum afgerond', 'date'), field('photoFileId', 'Foto', 'image'), field('reminder', 'Herinnering', 'date'),
      field('outingId', 'Gekoppeld uitje-ID'), field('notes', 'Notitie', 'textarea', { wide: true })
    ], conversions: ['outing']
  },
  home_project: {
    title: 'Klusprojecten', singular: 'klusproject', group: 'Thuis', icon: 'inventory',
    description: 'Plan grotere klussen met stappen, materiaal, taken en uitgaven.', titleField: 'title', dateField: 'endDate',
    fields: [
      field('title', 'Titel', 'text', { required: true }), field('description', 'Omschrijving', 'textarea', { wide: true }), field('category', 'Categorie'),
      field('startDate', 'Startdatum', 'date'), field('endDate', 'Einddatum', 'date'), field('status', 'Status', 'select', { options: planStatus, default: 'idea' }),
      field('budget', 'Budget', 'number', { min: 0, step: 0.01 }), field('actualCosts', 'Werkelijke kosten', 'number', { min: 0, step: 0.01 }),
      field('progress', 'Voortgang %', 'number', { min: 0, step: 1 }), field('memberIds', 'Gezinsleden', 'members', { wide: true }),
      field('steps', 'Stappen', 'checklist', { wide: true }), field('taskIds', 'Gekoppelde taak-ID’s', 'lines', { wide: true }),
      field('materials', 'Materialen', 'lines', { wide: true }), field('shoppingIds', 'Gekoppelde boodschappen-ID’s', 'lines', { wide: true }),
      field('expenseIds', 'Gekoppelde uitgave-ID’s', 'lines', { wide: true }), field('beforeFileId', 'Afbeelding voor', 'image'), field('afterFileId', 'Afbeelding na', 'image'),
      field('documentFileId', 'Document', 'file'), field('notes', 'Notities', 'textarea', { wide: true })
    ]
  }
});

export const ASSISTANT_GROUPS = Object.freeze(['Vandaag', 'Gezin', 'Plannen', 'Thuis', 'Geld']);

export function getAssistantModule(key) { return ASSISTANT_MODULES[key] || null; }

export function modulesByGroup() {
  return ASSISTANT_GROUPS.map((group) => ({
    group,
    modules: Object.entries(ASSISTANT_MODULES).filter(([, definition]) => definition.group === group)
  }));
}
