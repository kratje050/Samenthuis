import { urlBase64ToUint8Array } from '../js/services/push-notification-service.js';
import { SupabaseClient } from '../js/services/supabase-client.js';
import { equal, includes } from './test-utils.js';

export const pushTests = [
  ['VAPID openbare sleutel wordt correct omgezet', () => {
    const bytes = urlBase64ToUint8Array('AQIDBA');
    equal([...bytes].join(','), '1,2,3,4');
  }],
  ['pushfunctie ontvangt de ingelogde sessie', async () => {
    let request;
    const client = new SupabaseClient({ url: 'https://voorbeeld.supabase.co', publishableKey: 'public-test', fetcher: async (url, options) => {
      request = { url: String(url), options };
      return { ok: true, status: 200, text: async () => '{"publicKey":"test"}' };
    } });
    await client.invokeFunction('send-reminders', { action: 'config' }, 'user-token');
    includes(request.url, '/functions/v1/send-reminders');
    equal(request.options.headers.Authorization, 'Bearer user-token');
  }]
];
