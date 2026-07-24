import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSISTANT_ENTITY_TYPES } from '../js/config.js';
import { ASSISTANT_MODULES } from '../js/modules/assistant-modules.js';
import { filterAssistantRecords } from '../js/services/assistant-service.js';
import { priceHistoryStats } from '../js/services/finance-tools-service.js';
import { assert, equal, includes } from './test-utils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

export const staticTests = [
  ['manifest bevat geldige PWA-kernvelden en bestaande iconen', () => {
    const manifest = JSON.parse(read('manifest.json')); assert(manifest.name && manifest.short_name); assert(manifest.start_url); equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) assert(fs.existsSync(path.join(root, icon.src.replace(/^\.\//, ''))), `Ontbrekend icoon ${icon.src}`);
  }],
  ['alle service-worker app-shellbestanden bestaan', () => {
    const worker = read('service-worker.js');
    const paths = [...worker.matchAll(/'((?:\.\/)[^']+)'/g)].map((match) => match[1]).filter((item) => !item.includes('#'));
    for (const item of new Set(paths)) { if (item === './') continue; assert(fs.existsSync(path.join(root, item.slice(2))), `Ontbreekt in app-shell: ${item}`); }
    includes(worker, "url.origin !== self.location.origin");
  }],
  ['frontend bevat geen inline onclick-handlers of service-role sleutel', () => {
    const files = fs.readdirSync(path.join(root, 'js'), { recursive: true }).filter((file) => String(file).endsWith('.js')).map((file) => path.join(root, 'js', file));
    const source = [read('index.html'), ...files.map((file) => fs.readFileSync(file, 'utf8'))].join('\n');
    assert(!/onclick\s*=/.test(source), 'Inline onclick gevonden'); assert(!/service[_-]?role/i.test(source), 'Service-role verwijzing in frontend gevonden');
  }],
  ['alle assistentmodules staan in configuratie en synccatalogus', () => {
    equal(Object.keys(ASSISTANT_MODULES).length, 23); equal(ASSISTANT_ENTITY_TYPES.length, 23);
    const catalog = read('js/sync/entity-catalog.js'); for (const type of ASSISTANT_ENTITY_TYPES) assert(new RegExp(`(?:^|[\\s,])${type}:`).test(catalog), `Ontbreekt in synccatalogus: ${type}`);
  }],
  ['Supabase-migratie bevat cadeau-RLS en private Storage-regels', () => {
    const sql = read('supabase/migrations/202607150001_assistant_modules.sql').toLocaleLowerCase();
    includes(sql, 'hiddenforuserids'); includes(sql, 'can_read_family_record'); includes(sql, 'samen-thuis-private'); includes(sql, 'storage.objects'); includes(sql, 'auth.uid()');
    assert(!/disable\s+row\s+level\s+security/.test(sql));
  }],
  ['achtergrondmeldingen dekken belangrijke gezinszaken en echte Web Push', () => {
    const worker = read('service-worker.js');
    const pushFunction = read('supabase/functions/send-reminders/index.ts');
    const migration = read('supabase/migrations/202607150002_background_notifications.sql').toLocaleLowerCase();
    for (const type of ['appointment', 'task', 'pet', 'inventory', 'outing', 'waste', 'routine', 'maintenance', 'subscription', 'babysitting', 'packing']) {
      includes(pushFunction, `'${type}'`, `Pushmelding ontbreekt voor ${type}`);
    }
    includes(pushFunction, "body.action === 'test'");
    includes(pushFunction, 'webpush.sendNotification');
    includes(pushFunction, 'export default { fetch: handleRequest }');
    includes(worker, "self.addEventListener('push'");
    includes(worker, "self.addEventListener('pushsubscriptionchange'");
    includes(worker, "action: 'open'");
    includes(migration, 'enable row level security');
    includes(migration, 'service_role');
    includes(migration, 'cron.schedule');
    assert(!/grant\s+.*push_(configuration|subscriptions|delivery_log).*\s+to\s+(anon|authenticated)/s.test(migration));
  }],
  ['automatische punten zijn offline gecachet en zichtbaar in taken en dashboard', () => {
    const worker = read('service-worker.js');
    const tasks = read('js/views/tasks-view.js');
    const dashboard = read('js/views/dashboard-view.js');
    includes(worker, './js/services/points-service.js');
    includes(tasks, 'Automatisch berekende punten');
    includes(tasks, 'calculateTaskPoints');
    includes(dashboard, 'Puntenstrijd deze week');
    includes(dashboard, 'summarizeWeeklyPoints');
  }],
  ['gezinsbibliotheek en automatische uitdagingen zijn volledig offline gecachet', () => {
    const worker = read('service-worker.js');
    const app = read('js/app.js');
    const tasks = read('js/views/tasks-view.js');
    const rewards = read('js/views/assistant-view.js');
    for (const file of [
      './js/data/family-content-library.js',
      './js/services/family-content-service.js',
      './js/services/challenge-progress-service.js'
    ]) includes(worker, file);
    includes(app, 'ensureStarterFamilyContent');
    includes(tasks, 'applyAutomaticTaskChallenges');
    includes(rewards, 'Loopt automatisch');
  }],
  ['filteren blijft snel met grote testsets', () => {
    const records = Array.from({ length: 4000 }, (_, index) => ({ title: `Item ${index}`, category: index % 2 ? 'A' : 'B', memberIds: [index % 3 ? 'roy' : 'demy'] }));
    const start = performance.now(); const result = filterAssistantRecords(records, { query: 'Item', typeField: 'category', type: 'A', memberField: 'memberIds', memberId: 'roy' });
    assert(result.length > 0); assert(performance.now() - start < 500, 'Filteren duurde langer dan 500 ms');
  }],
  ['prijsanalyse verwerkt 500 registraties snel', () => {
    const records = Array.from({ length: 500 }, (_, index) => ({ productName:'Melk', store:`Winkel ${index % 5}`, quantity:1, price:1 + index / 1000, date:`2026-${String(index % 12 + 1).padStart(2,'0')}-01` }));
    const start = performance.now(); const result = priceHistoryStats(records, 'Melk'); equal(result.count, 500); assert(performance.now() - start < 250);
  }]
];
