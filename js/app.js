import { initializeDatabase } from './database/indexed-db.js';
import { initializeState, appState, services } from './state.js';
import { initializeRouter } from './router.js';
import { ReminderService } from './services/reminder-service.js';
import { showToast } from './components/toast.js';
import { openGlobalSearch } from './components/global-search.js';
import { openQuickAdd } from './components/quick-add.js';

function applyTheme(theme = 'system') {
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
}

function initializeConnectivity() {
  const banner = document.querySelector('#offline-banner');
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', () => { update(); showToast('Je bent weer online. De app blijft lokaal werken.'); });
  window.addEventListener('offline', update);
  update();
}

function initializeThemeToggle() {
  document.querySelector('#theme-toggle').addEventListener('click', async () => {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('samen-thuis-theme', next);
    const { repositories } = await import('./state.js');
    await repositories.settings.save({ theme: next });
    appState.settings.theme = next;
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (appState.settings?.theme === 'system') applyTheme('system'); });
}

function initializeGlobalActions() {
  document.querySelector('#global-search').addEventListener('click', openGlobalSearch);
  document.querySelector('#quick-add').addEventListener('click', openQuickAdd);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') { event.preventDefault(); openGlobalSearch(); }
  });
}

function showInAppReminder({ title, message }) {
  const root = document.querySelector('#reminder-root');
  const reminder = document.createElement('div');
  reminder.className = 'reminder'; reminder.setAttribute('role', 'alert');
  reminder.innerHTML = `<strong></strong><div class="small"></div><button class="text-button" type="button">Sluiten</button>`;
  reminder.querySelector('strong').textContent = title; reminder.querySelector('.small').textContent = message;
  reminder.querySelector('button').addEventListener('click', () => reminder.remove()); root.append(reminder);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const registration = await navigator.serviceWorker.register('./service-worker.js');
  const banner = document.querySelector('#update-banner');
  const showUpdate = (worker) => {
    banner.hidden = false;
    document.querySelector('#apply-update').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
  };
  if (registration.waiting) showUpdate(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker); });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  setInterval(() => registration.update(), 60 * 60 * 1000);
}

async function start() {
  try {
    applyTheme(localStorage.getItem('samen-thuis-theme') || 'system');
    await initializeDatabase();
    await initializeState();
    applyTheme(appState.settings.theme);
    initializeConnectivity(); initializeThemeToggle(); initializeGlobalActions();
    await initializeRouter();
    const reminders = new ReminderService(services.agenda, showInAppReminder); reminders.start();
    await registerServiceWorker();
    document.querySelector('#app').setAttribute('aria-busy', 'false');
  } catch (error) {
    console.error(error);
    document.querySelector('#main-content').innerHTML = `<div class="card"><h1>Starten is niet gelukt</h1><p></p><button class="button" type="button">Opnieuw proberen</button></div>`;
    document.querySelector('#main-content p').textContent = error.message || 'Controleer of je browser IndexedDB ondersteunt.';
    document.querySelector('#main-content button').addEventListener('click', () => location.reload());
  }
}

window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); window.samenThuisInstallPrompt = event; window.dispatchEvent(new CustomEvent('samen-thuis-install-ready')); });
start();
