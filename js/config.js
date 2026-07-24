export const APP_NAME = 'Samen Thuis';
export const APP_VERSION = '3.1.0';
export const DATABASE_NAME = globalThis.SAMEN_THUIS_TEST_DB || 'samen-thuis-db';
export const DATABASE_VERSION = 4;
export const SETTINGS_ID = '20000000-0000-4000-8000-000000000001';

export const SUPABASE = Object.freeze({
  url: 'https://idzfbonwkkqaqnzubmxg.supabase.co',
  publishableKey: 'sb_publishable_JT8fyOu93Dke7D_NlbzbCw_GsGbUPtO'
});

export const STORES = Object.freeze({
  appointments: 'appointments',
  shopping: 'shopping',
  tasks: 'tasks',
  meals: 'meals',
  inventory: 'inventory',
  expenses: 'expenses',
  pets: 'pets',
  outings: 'outings',
  settings: 'settings',
  outbox: 'outbox',
  backups: 'backups',
  cloud: 'cloud',
  activity: 'activity',
  templates: 'templates',
  assistant: 'assistantRecords',
  history: 'recordHistory',
  files: 'files',
  fileBlobs: 'fileBlobs'
});

export const ASSISTANT_ENTITY_TYPES = Object.freeze([
  'notice', 'inbox', 'packing', 'child', 'routine', 'family_mode', 'maintenance',
  'appliance', 'storage_location', 'loan', 'gift', 'waste', 'babysitting', 'emergency',
  'subscription', 'savings_goal', 'price_history', 'visit_plan', 'decision_wheel',
  'reward', 'family_memory', 'bucket_list', 'home_project'
]);

export const SYNC_STATUSES = ['local', 'pending', 'synced', 'conflict'];
export const ROUTES = ['home', 'agenda', 'shopping', 'tasks', 'daily', 'departure', 'packing', 'routines', 'leftovers', 'decision', 'babysitter', 'emergency', 'conflicts', 'history', 'meals', 'inventory', 'expenses', 'pets', 'outings', 'activity', 'templates', 'assistant', 'settings'];

export const MEMBER_IDS = Object.freeze({
  roy: '10000000-0000-4000-8000-000000000001', demy: '10000000-0000-4000-8000-000000000002',
  miley: '10000000-0000-4000-8000-000000000003', navy: '10000000-0000-4000-8000-000000000004'
});
export const DEFAULT_MEMBERS = [
  { id: MEMBER_IDS.roy, name: 'Roy', color: '#8f5f4a', icon: 'R' },
  { id: MEMBER_IDS.demy, name: 'Demy', color: '#a86073', icon: 'D' },
  { id: MEMBER_IDS.miley, name: 'Miley', color: '#b27d3d', icon: 'M' },
  { id: MEMBER_IDS.navy, name: 'Navy', color: '#4f7770', icon: 'N' }
];

export const APPOINTMENT_CATEGORIES = ['Gezin', 'Werk', 'School of opvang', 'Fotoshoot', 'Medisch', 'Dierenarts', 'Verjaardag', 'Huishouden', 'Vakantie', 'Overig'];
export const SHOPPING_CATEGORIES = ['Groente en fruit', 'Brood', 'Beleg', 'Zuivel', 'Vlees en vis', 'Diepvries', 'Drinken', 'Snacks', 'Baby en kinderen', 'Huishouden', 'Verzorging', 'Huisdieren', 'Overig'];
export const EXPENSE_CATEGORIES = ['Boodschappen', 'Vaste lasten', 'Kinderen', 'Vervoer', 'Huisdieren', 'Kleding', 'Uitjes', 'Fotografie', 'Medisch', 'Overig'];
export const OUTING_CATEGORIES = ['Kinderen', 'Dieren', 'Natuur', 'Binnen', 'Buiten', 'Markt', 'Evenement', 'Vakantie', 'Eten', 'Overig'];

export const APP_SHELL_FILES = [
  './', './index.html', './manifest.json', './css/variables.css', './css/base.css',
  './css/layout.css', './css/components.css', './css/calendar.css', './css/responsive.css'
];
