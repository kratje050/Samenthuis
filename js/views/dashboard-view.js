import { repositories, services, appState } from '../state.js';
import { addDays, formatDate, fromDateKey, monthKey, toDateKey } from '../utils/dates.js';
import { formatCurrency } from '../utils/formatting.js';
import { e } from './view-helpers.js';
import { downloadBackup, getBackupStatus } from '../services/backup-service.js';
import { accountDisplayName, personalizedGreeting } from '../utils/account.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { openBirthdayDialog } from '../components/birthday-dialog.js';
import { calculateTaskPoints, summarizeWeeklyPoints } from '../services/points-service.js';
import { routineAppliesToday } from '../services/routine-service.js';

const mealNames = { breakfast: 'Ontbijt', lunch: 'Lunch', dinner: 'Avondeten', snack: 'Tussendoortje' };
const expenseColors = ['#f28db2', '#a99acb', '#dbc19c', '#78b4ad', '#efb982', '#b0a093'];
const dashboardCardAliases = new Map([
  ['afspraken', 'appointments'], ['agenda', 'appointments'], ['taken', 'tasks'], ['boodschappen', 'shopping'],
  ['maaltijden', 'meals'], ['voorraad', 'inventory'], ['uitgaven', 'expenses'], ['verjaardagen', 'birthdays'],
  ['huisdieren', 'pets'], ['opslag', 'storage'], ['activiteit', 'activity'], ['prikbord', 'notices'],
  ['punten', 'points'], ['wedstrijd', 'points'], ['score', 'points']
]);

function dashboardModeKeys(values = []) {
  return values.map((value) => String(value).trim().toLocaleLowerCase('nl-NL')).map((value) => dashboardCardAliases.get(value) || value);
}

function dashboardCardAllowed(mode, key) {
  if (!mode) return true;
  const known = new Set(dashboardCardAliases.values());
  const visible = dashboardModeKeys(mode.visibleCards || []).filter((item) => known.has(item));
  const hidden = new Set(dashboardModeKeys(mode.hiddenInformation || []));
  return (!visible.length || visible.includes(key)) && !hidden.has(key);
}

function quickActionRoute(label) {
  const value = String(label).toLocaleLowerCase('nl-NL');
  if (value.includes('agenda') || value.includes('afspraak')) return 'agenda?new=1';
  if (value.includes('boodschap')) return 'shopping?new=1';
  if (value.includes('taak')) return 'tasks?new=1';
  if (value.includes('maaltijd') || value.includes('recept')) return 'meals';
  if (value.includes('paklijst')) return 'assistant?module=packing&new=1';
  return '';
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
}

function inventoryWarning(item) {
  const low = Number(item.quantity) <= Number(item.minimumQuantity);
  const expiry = item.expiryDate ? Math.ceil((fromDateKey(item.expiryDate) - fromDateKey(toDateKey())) / 86400000) : 999;
  return low || expiry <= 3;
}

function cardTitle(iconName, title) {
  return `<div class="dashboard-card-title">${icon(iconName)}<h2>${e(title)}</h2></div>`;
}

function cardLink(route, label) {
  return `<a class="dashboard-card-link" href="#${route}">${e(label)}${icon('arrow-right')}</a>`;
}

function emptyLine(label) {
  return `<p class="dashboard-empty">${e(label)}</p>`;
}

function birthdayLine(item) {
  const name = item.birthdayName || item.title;
  const age = item.birthYear ? Number(item.occurrenceDate.slice(0, 4)) - Number(item.birthYear) : null;
  const ageLabel = Number.isInteger(age) && age >= 0 ? ` wordt ${age}` : '';
  return `<p class="small birthday-line"><strong>${e(name)}${e(ageLabel)}</strong><span>${e(formatDate(item.occurrenceDate, { day: 'numeric', month: 'short' }))}</span></p>`;
}

function expenseBreakdown(expenses, month) {
  const current = expenses.filter((item) => item.date?.startsWith(month));
  const totals = new Map();
  current.forEach((item) => totals.set(item.category || 'Overig', (totals.get(item.category || 'Overig') || 0) + Number(item.amount || 0)));
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  let cursor = 0;
  const stops = entries.length ? entries.map(([, amount], index) => {
    const start = cursor;
    cursor += total ? amount / total * 100 : 0;
    return `${expenseColors[index % expenseColors.length]} ${start}% ${cursor}%`;
  }).join(',') : 'var(--beige) 0 100%';
  return { total, entries, stops };
}

export const dashboardView = {
  async render() {
    const now = new Date();
    const today = toDateKey(now);
    const [todayAppointments, upcoming, tasks, shopping, meals, inventory, expenses, pets, outbox, activity] = await Promise.all([
      services.agenda.occurrencesBetween(fromDateKey(today), fromDateKey(today, '23:59')),
      services.agenda.occurrencesBetween(now, addDays(now, 30)),
      repositories.tasks.getAll(), repositories.shopping.getAll(), repositories.meals.getAll(), repositories.inventory.getAll(),
      repositories.expenses.getAll(), repositories.pets.getAll(), repositories.outbox.getPendingChanges(), repositories.activity.recent(5)
    ]);

    const openTasks = tasks.filter((item) => item.status !== 'done');
    const openShopping = shopping.filter((item) => !item.checked);
    const todayMeals = meals.filter((item) => item.kind === 'plan' && item.date === today);
    const lowInventory = inventory.filter(inventoryWarning);
    const expense = expenseBreakdown(expenses, monthKey());
    const birthdays = upcoming.filter((item) => item.category === 'Verjaardag').slice(0, 4);
    const next = upcoming.find((item) => item.occurrenceDate > today || (item.occurrenceDate === today && !item.completed));
    const petAlerts = pets.flatMap((pet) => {
      const alerts = [];
      if (pet.medication && pet.medicationTime) alerts.push(`${pet.name}: ${pet.medication} om ${pet.medicationTime}`);
      if (pet.vetAppointment) {
        const when = new Date(pet.vetAppointment);
        if (when >= now && when <= addDays(now, 30)) alerts.push(`${pet.name}: dierenarts ${when.toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}`);
      }
      return alerts;
    });
    const [notices, maintenance, loans, waste, routines, subscriptions, familyModes] = await Promise.all([
      repositories.modules.notice.getAll(), repositories.modules.maintenance.getAll(), repositories.modules.loan.getAll(),
      repositories.modules.waste.getAll(), repositories.modules.routine.getAll(), repositories.modules.subscription.getAll(), repositories.modules.family_mode.getAll()
    ]);
    const importantNotices = notices.filter((item) => item.status !== 'archived' && (!item.expiryDate || item.expiryDate >= today) && (item.important || item.pinned));
    const overdueMaintenance = maintenance.filter((item) => item.nextDate && item.nextDate < today && !['done','archived'].includes(item.status));
    const overdueLoans = loans.filter((item) => item.expectedReturnDate && item.expectedReturnDate <= today && item.status !== 'returned');
    const todayWaste = waste.filter((item) => item.date === today && !item.broughtInside);
    const todayRoutines = routines.filter((item) => routineAppliesToday(item, now));
    const dueSubscriptions = subscriptions.filter((item) => item.status === 'active' && (Number(item.debitDay) === now.getDate() || item.trialEndDate === today || item.contractEndDate === today));
    const weeklyPoints = summarizeWeeklyPoints({ tasks, routines, members: appState.settings.members || [], now });
    const activeMode = familyModes.find((item) => item.active);
    const modeRoutineIds = new Set(activeMode?.activeRoutineIds || []);
    const visibleRoutines = todayRoutines.filter((item) => !modeRoutineIds.size || modeRoutineIds.has(item.id));
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const dashboardTasks = activeMode?.priorityRules ? [...openTasks].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)) : openTasks;
    const todayAttentionCount = importantNotices.length + overdueMaintenance.length + overdueLoans.length + todayWaste.length + visibleRoutines.length + dueSubscriptions.length;

    let storage = 'Lokale opslag beschikbaar';
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.usage !== undefined) storage = `${(estimate.usage / 1024 / 1024).toFixed(1)} MB lokaal gebruikt`;
    } catch {}

    const backupStatus = getBackupStatus(now);
    const cloud = appState.cloud;
    const cloudActive = Boolean(cloud.family);
    const greetingLine = personalizedGreeting(greeting(), accountDisplayName(cloud));
    const dateLabel = formatDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `<section class="page-stack dashboard-page">
      <header class="dashboard-hero">
        <div><h1>${e(greetingLine)} <span aria-hidden="true">👋</span></h1><p>Fijn dat je er bent. Dit is jullie gezinsoverzicht.</p></div>
        <div class="dashboard-status-chips">
          <button class="home-status-chip" type="button" data-open-cloud>${icon(cloudActive ? 'cloud' : 'cloud')}<span><strong>${cloudActive ? 'Cloudsync' : 'Lokaal'}</strong><small>${cloudActive ? 'Automatisch' : 'Offline klaar'}</small></span></button>
          <div class="home-status-chip">${icon('calendar')}<span><strong>${e(formatDate(now, { weekday: 'long' }))}</strong><small>${e(formatDate(now, { day: 'numeric', month: 'long', year: 'numeric' }))}</small></span></div>
        </div>
      </header>

      <a class="daily-overview-link" href="#daily"><span>${icon('home')}</span><span><strong>Wat mogen we vandaag niet vergeten?</strong><small>${todayAttentionCount ? `${todayAttentionCount} extra aandachtspunt${todayAttentionCount === 1 ? '' : 'en'}${activeMode ? ` · ${activeMode.title}` : ''}` : `Alles rustig op orde${activeMode ? ` · ${activeMode.title}` : ''}`}</small></span>${icon('chevron-right')}</a>

      ${activeMode ? `<article class="card compact family-mode-banner"><div><span class="badge low">Actieve gezinsmodus</span><h2>${e(activeMode.title)}</h2>${activeMode.priorityRules ? `<p class="small muted">Taakfocus: ${e(activeMode.priorityRules)}</p>` : ''}${(activeMode.prominentReminders || []).map((item) => `<p class="small"><strong>${e(item)}</strong></p>`).join('')}</div><div class="page-actions">${(activeMode.quickActions || []).map((item) => { const route = quickActionRoute(item); return route ? `<a class="button small secondary" href="#${e(route)}">${e(item)}</a>` : `<span class="badge">${e(item)}</span>`; }).join('')}<a class="button small ghost" href="#assistant?module=family_mode">Modus beheren</a></div></article>` : ''}

      <div class="dashboard-primary-grid">
        <article class="dashboard-card" ${dashboardCardAllowed(activeMode, 'appointments') ? '' : 'hidden'}>
          ${cardTitle('calendar', 'Afspraken vandaag')}
          <div class="dashboard-rows">${todayAppointments.length ? todayAppointments.slice(0, 3).map((item) => `<div class="dashboard-row"><time>${item.allDay ? 'Dag' : e(item.startTime)}</time><span><strong>${e(item.title)}</strong><small>${e(item.location || item.category || '')}</small></span></div>`).join('') : emptyLine('Geen afspraken vandaag.')}</div>
          ${cardLink('agenda', 'Naar agenda')}
        </article>

        <article class="dashboard-card" ${dashboardCardAllowed(activeMode, 'tasks') ? '' : 'hidden'}>
          ${cardTitle('tasks', 'Taken')}
          <div class="dashboard-rows">${dashboardTasks.length ? dashboardTasks.slice(0, 3).map((item) => `<div class="dashboard-row dashboard-check-row"><span class="fake-check" aria-hidden="true"></span><span><strong>${e(item.title)}</strong><small>${e((appState.settings.members || []).find((member) => member.id === item.assignedTo)?.name || item.category || 'Gezin')}</small></span><em class="priority-pill ${e(item.priority || 'normal')}">${appState.settings.rewardsEnabled !== false ? `${e(item.rewardPoints || calculateTaskPoints(item).points)} pt · ` : ''}${e(({ low: 'Laag', normal: 'Normaal', high: 'Hoog', urgent: 'Dringend' })[item.priority] || 'Normaal')}</em></div>`).join('') : emptyLine('Geen openstaande taken.')}</div>
          ${cardLink('tasks', 'Naar taken')}
        </article>

        <article class="dashboard-card" ${dashboardCardAllowed(activeMode, 'shopping') ? '' : 'hidden'}>
          ${cardTitle('cart', 'Boodschappen')}
          <div class="dashboard-rows">${openShopping.length ? openShopping.slice(0, 4).map((item) => `<div class="dashboard-row dashboard-check-row"><span class="fake-circle" aria-hidden="true"></span><strong>${e(item.productName)}</strong><em class="quantity-pill">${e(`${item.quantity || ''}${item.unit ? ` ${item.unit}` : ''}`.trim())}</em></div>`).join('') : emptyLine('De boodschappenlijst is leeg.')}</div>
          ${cardLink('shopping', 'Naar boodschappen')}
        </article>

        <article class="dashboard-card" ${dashboardCardAllowed(activeMode, 'meals') ? '' : 'hidden'}>
          ${cardTitle('meals', 'Maaltijden vandaag')}
          <div class="dashboard-rows">${todayMeals.length ? todayMeals.slice(0, 4).map((item) => `<div class="dashboard-row meal-row"><span><strong>${e(mealNames[item.mealType] || 'Maaltijd')}</strong><small>${e(item.name)}</small></span></div>`).join('') : emptyLine('Nog geen maaltijden gepland.')}</div>
          ${cardLink('meals', 'Naar maaltijdplanner')}
        </article>

        <article class="dashboard-card" ${dashboardCardAllowed(activeMode, 'inventory') ? '' : 'hidden'}>
          ${cardTitle('inventory', 'Lage voorraad')}
          <div class="dashboard-rows">${lowInventory.length ? lowInventory.slice(0, 4).map((item) => `<div class="dashboard-row inventory-row"><strong>${e(item.productName)}</strong><em class="stock-pill">${e(`${item.quantity ?? 0} ${item.unit || ''}`.trim())}</em></div>`).join('') : emptyLine('De voorraad is op peil.')}</div>
          ${cardLink('inventory', 'Naar voorraad')}
        </article>

        <article class="dashboard-card expense-card" ${dashboardCardAllowed(activeMode, 'expenses') ? '' : 'hidden'}>
          ${cardTitle('expenses', 'Uitgaven deze maand')}
          <strong class="expense-total">${formatCurrency(expense.total, appState.settings.currency)}</strong>
          <div class="expense-visual"><div class="expense-donut" style="--expense-stops:${expense.stops}"></div><div class="expense-legend">${expense.entries.slice(0, 4).map(([category, amount], index) => `<div><i style="--legend-color:${expenseColors[index % expenseColors.length]}"></i><span>${e(category)}</span><strong>${formatCurrency(amount, appState.settings.currency)}</strong></div>`).join('') || '<span class="muted">Nog geen uitgaven</span>'}</div></div>
          ${cardLink('expenses', 'Naar uitgaven')}
        </article>
      </div>

      <article class="offline-home-card">
        <div>${icon(cloudActive ? 'cloud' : 'cloud')}<span><strong>${cloudActive ? 'Je gezin wordt automatisch gesynchroniseerd' : 'Je gebruikt de app offline'}</strong><small>${cloudActive ? 'Alle gegevens blijven ook offline op dit apparaat beschikbaar.' : 'Alle gegevens staan alleen op dit apparaat. Maak regelmatig een back-up.'}</small><button id="dashboard-backup" class="button secondary small" type="button">Back-up maken</button></span></div>
      </article>

      <div class="dashboard-secondary-grid">
        ${appState.settings.rewardsEnabled !== false ? `<article class="card compact points-race-card" ${dashboardCardAllowed(activeMode, 'points') ? '' : 'hidden'}><div class="card-header"><h2>Puntenstrijd deze week</h2><strong>${weeklyPoints.teamPoints} pt samen</strong></div>${weeklyPoints.ranking.length ? `<div class="points-ranking">${weeklyPoints.ranking.slice(0, 4).map((entry, index) => `<div class="points-ranking-row"><span class="tiny-avatar" style="--member-color:${e(entry.color || '#8f5f4a')}">${e(String(entry.icon || entry.name).slice(0, 1))}</span><span><strong>${index === 0 && entry.points ? '🏆 ' : ''}${e(entry.name)}</strong><small>${entry.completed} afgerond</small></span><em>${entry.points} pt</em></div>`).join('')}</div>` : '<p class="muted small">Rond een taak of routine af om de wedstrijd te starten.</p>'}${weeklyPoints.unassignedPoints ? `<p class="small muted">${weeklyPoints.unassignedPoints} punten zijn nog niet aan een gezinslid gekoppeld.</p>` : ''}<a href="#tasks">Punten verdienen</a></article>` : ''}
        <article class="card compact"><h2>Eerstvolgende afspraak</h2>${next ? `<strong>${e(next.title)}</strong><p class="small muted">${e(formatDate(next.occurrenceDate))}${next.allDay ? '' : ` · ${e(next.startTime)}`}</p>` : '<p class="muted small">Geen komende afspraak.</p>'}</article>
        <article class="card compact birthday-card" ${dashboardCardAllowed(activeMode, 'birthdays') ? '' : 'hidden'}><h2>Aankomende verjaardagen</h2>${birthdays.length ? birthdays.map(birthdayLine).join('') : '<p class="muted small">Geen verjaardagen in de komende 30 dagen.</p>'}<button class="birthday-add-link" type="button" data-add-birthday>${icon('birthday')} Verjaardag toevoegen</button></article>
        <article class="card compact" ${dashboardCardAllowed(activeMode, 'pets') ? '' : 'hidden'}><h2>Huisdierherinneringen</h2>${petAlerts.length ? petAlerts.slice(0, 3).map((alert) => `<p class="small">${e(alert)}</p>`).join('') : '<p class="muted small">Geen dierenarts- of medicatiemeldingen.</p>'}</article>
        <article class="card compact" ${dashboardCardAllowed(activeMode, 'storage') ? '' : 'hidden'}><h2>Opslag en sync</h2><p class="small"><strong>${e(storage)}</strong></p><p class="small muted">${outbox.length} wijziging${outbox.length === 1 ? '' : 'en'} in de lokale outbox.</p><a href="#settings">Instellingen openen</a></article>
        <article class="card compact dashboard-activity" ${dashboardCardAllowed(activeMode, 'activity') ? '' : 'hidden'}><h2>Recente gezinsactiviteit</h2>${activity.length ? activity.slice(0, 3).map((item) => `<p class="small"><strong>${e(item.actorName || 'Een gezinslid')}</strong> <span class="muted">heeft ${e(item.title)} aangepast.</span></p>`).join('') : '<p class="muted small">Nieuwe wijzigingen verschijnen hier.</p>'}</article>
        <article class="card compact" ${dashboardCardAllowed(activeMode, 'notices') ? '' : 'hidden'}><h2>Prikbord en thuis</h2>${importantNotices.slice(0,2).map((item) => `<p class="small"><strong>${e(item.title)}</strong> <span class="muted">${e(item.message)}</span></p>`).join('') || '<p class="muted small">Geen belangrijke prikbordberichten.</p>'}${overdueMaintenance.length ? `<p class="small"><strong>${overdueMaintenance.length}× onderhoud achterstallig</strong></p>` : ''}${overdueLoans.length ? `<p class="small"><strong>${overdueLoans.length} item${overdueLoans.length === 1 ? '' : 's'} terugbrengen</strong></p>` : ''}<a href="#daily">Volledig dagoverzicht</a></article>
      </div>
      <p class="dashboard-date-mobile">${e(dateLabel)}</p>
    </section>`;
  },

  async mount(root) {
    const rerender = async () => {
      root.innerHTML = await dashboardView.render();
      await dashboardView.mount(root);
    };
    root.querySelector('#dashboard-backup')?.addEventListener('click', async () => {
      await downloadBackup();
      showToast('Back-up is gedownload.', 'success');
    });
    root.querySelector('[data-open-cloud]')?.addEventListener('click', () => document.querySelector('#cloud-status')?.click());
    root.querySelector('[data-add-birthday]')?.addEventListener('click', () => openBirthdayDialog({ onSaved: rerender }));
  }
};
