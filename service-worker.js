const CACHE_VERSION = 'samen-thuis-v1.1.1';
const APP_SHELL = [
  './', './index.html', './manifest.json',
  './assets/icons/icon-192.svg', './assets/icons/icon-512.svg',
  './css/variables.css', './css/base.css', './css/layout.css', './css/components.css', './css/calendar.css', './css/responsive.css',
  './js/app.js', './js/config.js', './js/router.js', './js/state.js',
  './js/database/indexed-db.js', './js/database/migrations.js', './js/database/database-schema.js',
  './js/repositories/base-repository.js', './js/repositories/appointment-repository.js', './js/repositories/shopping-repository.js', './js/repositories/task-repository.js', './js/repositories/meal-repository.js', './js/repositories/inventory-repository.js', './js/repositories/expense-repository.js', './js/repositories/pet-repository.js', './js/repositories/outing-repository.js', './js/repositories/settings-repository.js', './js/repositories/outbox-repository.js',
  './js/services/agenda-service.js', './js/services/recurrence-service.js', './js/services/reminder-service.js', './js/services/backup-service.js', './js/services/import-service.js', './js/services/validation-service.js', './js/services/notification-service.js', './js/services/data-management-service.js', './js/services/meal-service.js', './js/services/inventory-service.js', './js/services/expense-service.js', './js/services/search-service.js', './js/services/trash-service.js',
  './js/views/view-helpers.js', './js/views/dashboard-view.js', './js/views/agenda-view.js', './js/views/shopping-view.js', './js/views/tasks-view.js', './js/views/meals-view.js', './js/views/inventory-view.js', './js/views/expenses-view.js', './js/views/pets-view.js', './js/views/outings-view.js', './js/views/settings-view.js', './js/views/more-view.js',
  './js/components/modal.js', './js/components/toast.js', './js/components/date-picker.js', './js/components/time-picker.js', './js/components/calendar-month.js', './js/components/calendar-week.js', './js/components/calendar-day.js', './js/components/confirm-dialog.js', './js/components/global-search.js', './js/components/quick-add.js',
  './js/utils/uuid.js', './js/utils/dates.js', './js/utils/formatting.js', './js/utils/device.js', './js/utils/sanitization.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('samen-thuis-') && name !== CACHE_VERSION).map((name) => caches.delete(name)))),
    self.clients.claim()
  ]));
});

self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy)); return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)); }
    return response;
  })));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients[0]; if (existing) { existing.navigate('./#agenda'); return existing.focus(); }
    return self.clients.openWindow('./#agenda');
  }));
});
