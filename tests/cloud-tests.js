import { newestByRecord, pullCursorQuery } from '../js/services/sync-service.js';
import { SupabaseClient } from '../js/services/supabase-client.js';
import { assert, equal, includes } from './test-utils.js';

export const cloudTests = [
  ['syncwachtrij kiest per record de hoogste versie', () => {
    const result = newestByRecord([
      { entityType: 'appointments', recordId: 'a', version: 1, changedAt: '2026-01-01' },
      { entityType: 'appointment', recordId: 'a', version: 3, changedAt: '2026-01-03' },
      { entityType: 'task', recordId: 'b', version: 2, changedAt: '2026-01-02' }
    ]);
    equal(result.length, 2);
    equal(result.find((item) => item.recordId === 'a').version, 3);
    equal(result.find((item) => item.recordId === 'a').canonical, 'appointment');
  }],
  ['syncwachtrij kiest bij gelijke versie de nieuwste wijziging', () => {
    const result = newestByRecord([
      { entityType: 'shopping', recordId: 'a', version: 2, changedAt: '2026-01-01' },
      { entityType: 'shopping', recordId: 'a', version: 2, changedAt: '2026-01-02' }
    ]);
    equal(result[0].changedAt, '2026-01-02');
  }],
  ['aansluiten bij gezin zet opgehaalde records niet opnieuw in de outbox', async () => {
    const queued = [];
    const emptyRepository = { getAll: async () => [] };
    const repositories = {
      appointments: { getAll: async () => [{ id:'remote',version:2,syncStatus:'synced' },{ id:'local',version:1,syncStatus:'pending' }] },
      shopping:emptyRepository,tasks:emptyRepository,meals:emptyRepository,inventory:emptyRepository,
      expenses:emptyRepository,pets:emptyRepository,outings:emptyRepository,settings:emptyRepository,
      activity:emptyRepository,templates:emptyRepository,
      outbox:{getPendingChanges:async()=>[],queue:async(type,record)=>queued.push(`${type}:${record.id}`)}
    };
    const { SyncService } = await import('../js/services/sync-service.js');
    const service = new SyncService({client:{},auth:{},family:{},repositories,cloudRepository:{},onStateChange:()=>{}});
    await service.queueAllLocalRecords({includeSynced:false});
    equal(queued.join(','),'appointment:local');
  }],
  ['Supabase-client stuurt alleen de openbare sleutel en sessie', async () => {
    let request;
    const client = new SupabaseClient({ url: 'https://voorbeeld.supabase.co', publishableKey: 'public-test', fetcher: async (url, options) => {
      request = { url: String(url), options };
      return { ok: true, status: 200, text: async () => '{"ok":true}' };
    } });
    const result = await client.rpc('test', { waarde: 1 }, 'user-token');
    assert(result.ok);
    includes(request.url, '/rest/v1/rpc/test');
    equal(request.options.headers.apikey, 'public-test');
    equal(request.options.headers.Authorization, 'Bearer user-token');
  }],
  ['synchronisatiecursor voorkomt overslaan bij gelijke servertijd', () => {
    const query = pullCursorQuery({ serverUpdatedAt: '2026-07-15T10:00:00.000Z', recordId: '10000000-0000-4000-8000-000000000001' });
    includes(query.or, 'server_updated_at.gt.2026-07-15T10:00:00.000Z');
    includes(query.or, 'record_id.gt.10000000-0000-4000-8000-000000000001');
  }]
];
