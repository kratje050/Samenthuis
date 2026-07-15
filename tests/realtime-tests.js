import { RealtimeService, realtimeUrl } from '../js/services/realtime-service.js';
import { equal, includes } from './test-utils.js';

class FakeWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  open() { this.readyState = 1; this.onopen?.(); }
  send(message) { this.sent.push(JSON.parse(message)); }
  receive(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
  close() { this.readyState = 3; this.onclose?.(); }
}

function createService() {
  const scheduled = [];
  const statuses = [];
  const sync = {
    schedule: (reason, delay) => scheduled.push({ reason, delay }),
    setRealtimeConnected: (connected) => statuses.push(connected ? 'connected' : 'disconnected')
  };
  const service = new RealtimeService({
    url: 'https://voorbeeld.supabase.co',
    publishableKey: 'public-test',
    auth: { isSignedIn: true, getAccessToken: async () => 'user-token' },
    family: { context: { family_id: 'family-1' } },
    sync,
    WebSocketImpl: FakeWebSocket,
    onStatusChange: ({ status }) => statuses.push(status)
  });
  return { service, scheduled, statuses };
}

export const realtimeTests = [
  ['Realtime gebruikt een beveiligd gezinsfilter', async () => {
    const { service, scheduled, statuses } = createService();
    await service.start();
    const socket = FakeWebSocket.instances.at(-1);
    socket.open();
    const join = socket.sent[0];
    equal(join[3], 'phx_join');
    equal(join[4].access_token, 'user-token');
    equal(join[4].config.postgres_changes[0].filter, 'family_id=eq.family-1');
    socket.receive([join[0], join[1], join[2], 'phx_reply', { status: 'ok', response: { postgres_changes: [{ id: 1 }] } }]);
    equal(statuses.at(-2), 'connected');
    equal(statuses.at(-1), 'connected');
    equal(scheduled[0].reason, 'live verbinding gestart');
    service.stop();
  }],
  ['Realtime wijziging start direct een synchronisatie', async () => {
    const { service, scheduled } = createService();
    await service.start();
    const socket = FakeWebSocket.instances.at(-1);
    socket.open();
    const join = socket.sent[0];
    socket.receive([null, null, join[2], 'postgres_changes', { data: { record: { family_id: 'family-1' } } }]);
    equal(scheduled.at(-1).reason, 'live gezinswijziging');
    equal(scheduled.at(-1).delay, 40);
    service.stop();
  }],
  ['Realtime zonder publicatie houdt de terugval actief', async () => {
    const { service, statuses } = createService();
    await service.start();
    const socket = FakeWebSocket.instances.at(-1);
    socket.open();
    const join = socket.sent[0];
    socket.receive([join[0], join[1], join[2], 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]);
    equal(statuses.at(-1), 'degraded');
    service.stop();
  }],
  ['Realtime WebSocket gebruikt alleen de openbare sleutel', () => {
    const url = realtimeUrl('https://voorbeeld.supabase.co', 'public-test');
    includes(url, 'wss://voorbeeld.supabase.co/realtime/v1/websocket');
    includes(url, 'apikey=public-test');
    includes(url, 'vsn=2.0.0');
  }]
];
