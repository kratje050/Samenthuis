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
import { AgendaService } from './services/agenda-service.js';

const listeners = new Map();

export const repositories = {
  appointments: new AppointmentRepository(), shopping: new ShoppingRepository(), tasks: new TaskRepository(),
  meals: new MealRepository(), inventory: new InventoryRepository(), expenses: new ExpenseRepository(),
  pets: new PetRepository(), outings: new OutingRepository(), settings: new SettingsRepository(), outbox: new OutboxRepository()
};

export const services = { agenda: new AgendaService(repositories.appointments) };
export const appState = { settings: null, route: 'home' };

export function on(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => listeners.get(event)?.delete(callback);
}
export function emit(event, detail) { listeners.get(event)?.forEach((callback) => callback(detail)); }
export async function refreshSettings() { appState.settings = await repositories.settings.get(); emit('settings', appState.settings); return appState.settings; }
export async function initializeState() { await refreshSettings(); }
