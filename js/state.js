import { AppointmentRepository } from './repositories/appointment-repository.js';
import { ShoppingRepository } from './repositories/shopping-repository.js';
import { TaskRepository } from './repositories/task-repository.js';
import { MealRepository } from './repositories/meal-repository.js';
import { InventoryRepository } from './repositories/inventory-repository.js';
import { ExpenseRepository } from './repositories/expense-repository.js';
import { PetRepository } from './repositories/pet-repository.js';
import { OutingRepository } from './repositories/outing-repository.js';
import { SettingsRepository } from './repositories/settings-repository.js';
import { OutboxRepository } from './repositories/outbox-repository.js';
import { CloudStateRepository } from './repositories/cloud-state-repository.js';
import { ActivityRepository } from './repositories/activity-repository.js';
import { TemplateRepository } from './repositories/template-repository.js';
import { ModuleRepository } from './repositories/module-repository.js';
import { HistoryRepository } from './repositories/history-repository.js';
import { FileRepository } from './repositories/file-repository.js';
import { AgendaService } from './services/agenda-service.js';
import { SupabaseClient } from './services/supabase-client.js';
import { AuthService } from './services/auth-service.js';
import { FamilyService } from './services/family-service.js';
import { SyncService } from './services/sync-service.js';
import { PushNotificationService } from './services/push-notification-service.js';
import { BackgroundSyncService } from './services/background-sync-service.js';
import { RealtimeService } from './services/realtime-service.js';
import { FileService } from './services/file-service.js';
import { ASSISTANT_ENTITY_TYPES, SUPABASE } from './config.js';
import { setActiveActor } from './utils/actor.js';

const listeners = new Map();

export const repositories = {
  appointments: new AppointmentRepository(), shopping: new ShoppingRepository(), tasks: new TaskRepository(),
  meals: new MealRepository(), inventory: new InventoryRepository(), expenses: new ExpenseRepository(),
  pets: new PetRepository(), outings: new OutingRepository(), settings: new SettingsRepository(), outbox: new OutboxRepository(),
  cloud: new CloudStateRepository()
};
repositories.activity = new ActivityRepository();
repositories.templates = new TemplateRepository();
repositories.history = new HistoryRepository();
repositories.files = new FileRepository();
repositories.modules = Object.fromEntries(ASSISTANT_ENTITY_TYPES.map((module) => [module, new ModuleRepository(module)]));

export const appState = {
  settings: null,
  route: 'home',
  cloud: {
    signedIn: false, user: null, session: null, family: null, familyMembers: [],
    sync: { status: 'local', lastSyncAt: null, pending: 0, conflicts: 0, error: null },
    realtime: { status: 'off', error: null }
  }
};

const supabaseClient = new SupabaseClient();

export const services = {
  agenda: new AgendaService(repositories.appointments)
};

services.auth = new AuthService(supabaseClient, repositories.cloud, (auth) => {
  appState.cloud = { ...appState.cloud, ...auth };
  if (!auth.signedIn && services.family) services.family.clear();
  if (!auth.signedIn) setActiveActor();
  if (services.backgroundSync) (auth.signedIn ? services.backgroundSync.refresh() : services.backgroundSync.disable()).catch(() => {});
  services.realtime?.refresh().catch(() => {});
  emit('cloud', appState.cloud);
});

services.family = new FamilyService(supabaseClient, services.auth, ({ context, members }) => {
  appState.cloud = { ...appState.cloud, family: context, familyMembers: members };
  setActiveActor(context ? { id: services.auth.user?.id, name: context.display_name } : {});
  services.backgroundSync?.refresh().catch(() => {});
  services.realtime?.refresh().catch(() => {});
  emit('cloud', appState.cloud);
});

services.sync = new SyncService({
  client: supabaseClient,
  auth: services.auth,
  family: services.family,
  repositories,
  cloudRepository: repositories.cloud,
  onStateChange: (sync) => {
    appState.cloud = { ...appState.cloud, sync };
    emit('cloud', appState.cloud);
  },
  onDataChange: async () => {
    await refreshSettings();
    globalThis.dispatchEvent?.(new CustomEvent('samen-thuis-data-synced'));
  }
});
services.push = new PushNotificationService(supabaseClient, services.auth, services.family);
services.files = new FileService({ repository: repositories.files, client: supabaseClient, auth: services.auth, family: services.family });
services.realtime = new RealtimeService({
  url: SUPABASE.url,
  publishableKey: SUPABASE.publishableKey,
  auth: services.auth,
  family: services.family,
  sync: services.sync,
  onStatusChange: (realtime) => {
    appState.cloud = { ...appState.cloud, realtime };
    emit('cloud', appState.cloud);
  }
});
services.backgroundSync = new BackgroundSyncService({
  auth: services.auth,
  family: services.family,
  sync: services.sync,
  outbox: repositories.outbox
});

export function on(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => listeners.get(event)?.delete(callback);
}
export function emit(event, detail) { listeners.get(event)?.forEach((callback) => callback(detail)); }
export async function refreshSettings() { appState.settings = await repositories.settings.get(); emit('settings', appState.settings); return appState.settings; }
export async function initializeState() { await refreshSettings(); }

export async function initializeCloudState() {
  try {
    await services.auth.initialize();
    if (services.auth.isSignedIn && navigator.onLine) await services.family.refreshContext();
  } catch (error) {
    appState.cloud = { ...appState.cloud, sync: { ...appState.cloud.sync, status: 'error', error: error.message } };
    emit('cloud', appState.cloud);
  }
  await services.sync.start();
  await services.realtime.start();
  return appState.cloud;
}
