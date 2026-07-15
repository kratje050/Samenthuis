const HEARTBEAT_INTERVAL = 20 * 1000;
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

function realtimeUrl(baseUrl, publishableKey) {
  const url = new URL(`${baseUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/realtime/v1/websocket`);
  url.searchParams.set('apikey', publishableKey);
  url.searchParams.set('vsn', '2.0.0');
  return url.toString();
}

export class RealtimeService {
  constructor({ url, publishableKey, auth, family, sync, WebSocketImpl = globalThis.WebSocket, onStatusChange = () => {} }) {
    this.url = url;
    this.publishableKey = publishableKey;
    this.auth = auth;
    this.family = family;
    this.sync = sync;
    this.WebSocketImpl = WebSocketImpl;
    this.onStatusChange = onStatusChange;
    this.socket = null;
    this.familyId = null;
    this.topic = null;
    this.joinRef = null;
    this.accessToken = null;
    this.reference = 0;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatCount = 0;
    this.started = false;
    this.status = { status: 'off', error: null };
    this.onlineHandler = () => this.refresh().catch(() => {});
    this.offlineHandler = () => this.#disconnect('offline');
    this.visibilityHandler = () => {
      if (globalThis.document?.visibilityState === 'visible') this.refresh().catch(() => {});
    };
  }

  get eligible() {
    return Boolean(this.auth.isSignedIn && this.family.context?.family_id && globalThis.navigator?.onLine !== false && this.WebSocketImpl);
  }

  async start() {
    if (this.started) return this.status;
    this.started = true;
    globalThis.addEventListener?.('online', this.onlineHandler);
    globalThis.addEventListener?.('offline', this.offlineHandler);
    globalThis.document?.addEventListener?.('visibilitychange', this.visibilityHandler);
    await this.refresh();
    return this.status;
  }

  async refresh() {
    if (!this.started) return false;
    if (!this.eligible) {
      this.#disconnect(globalThis.navigator?.onLine === false ? 'offline' : 'off');
      return false;
    }
    const nextFamilyId = this.family.context.family_id;
    if (this.socket && this.familyId !== nextFamilyId) this.#disconnect('connecting');
    if (this.socket && [0, 1].includes(this.socket.readyState)) {
      if (this.socket.readyState === 1) await this.#refreshAccessToken();
      return true;
    }
    return this.#connect(nextFamilyId);
  }

  stop() {
    this.started = false;
    globalThis.removeEventListener?.('online', this.onlineHandler);
    globalThis.removeEventListener?.('offline', this.offlineHandler);
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibilityHandler);
    this.#disconnect('off');
  }

  async #connect(familyId) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.#setStatus('connecting');
    try {
      const token = await this.auth.getAccessToken();
      if (!this.eligible || this.family.context?.family_id !== familyId) return false;
      const socket = new this.WebSocketImpl(realtimeUrl(this.url, this.publishableKey));
      this.socket = socket;
      this.familyId = familyId;
      this.topic = `realtime:samen-thuis-${familyId}`;
      this.accessToken = token;
      socket.onopen = () => {
        if (this.socket !== socket) return;
        this.joinRef = this.#nextRef();
        this.#send('phx_join', {
          config: {
            broadcast: { ack: false, self: false },
            presence: { enabled: false },
            postgres_changes: [{ event: '*', schema: 'public', table: 'family_records', filter: `family_id=eq.${familyId}` }],
            private: false
          },
          access_token: token
        }, { ref: this.joinRef, joinRef: this.joinRef });
        this.#startHeartbeat();
      };
      socket.onmessage = (event) => this.#handleMessage(event);
      socket.onerror = () => this.#setStatus('degraded', 'De live verbinding is tijdelijk niet beschikbaar.');
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        this.#stopHeartbeat();
        if (this.eligible) this.#scheduleReconnect();
        else this.#setStatus(globalThis.navigator?.onLine === false ? 'offline' : 'off');
      };
      return true;
    } catch (error) {
      this.#setStatus('degraded', error.message);
      this.#scheduleReconnect();
      return false;
    }
  }

  #handleMessage(event) {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!Array.isArray(message) || message.length < 5) return;
    const [, ref, topic, type, payload] = message;
    if (topic !== this.topic && topic !== 'phoenix') return;
    if (type === 'phx_reply' && ref === this.joinRef) {
      if (payload?.status === 'ok') {
        this.reconnectAttempt = 0;
        const subscriptions = payload?.response?.postgres_changes;
        this.#setStatus(Array.isArray(subscriptions) && subscriptions.length ? 'connected' : 'degraded',
          Array.isArray(subscriptions) && subscriptions.length ? null : 'De Realtime-publicatie is nog niet beschikbaar.');
        this.sync.schedule('live verbinding gestart', 50);
      } else {
        this.#setStatus('degraded', payload?.response?.reason || 'De live verbinding kon niet worden geopend.');
        this.socket?.close();
      }
      return;
    }
    if (type === 'system' && payload?.extension === 'postgres_changes') {
      if (payload.status === 'ok') this.#setStatus('connected');
      else this.#setStatus('degraded', payload.message || 'Live databasewijzigingen zijn niet beschikbaar.');
      return;
    }
    if (type === 'postgres_changes') {
      const recordFamilyId = payload?.data?.record?.family_id;
      if (!recordFamilyId || recordFamilyId === this.familyId) this.sync.schedule('live gezinswijziging', 40);
      return;
    }
    if (type === 'phx_error' || type === 'phx_close') this.socket?.close();
  }

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== 1) return;
      this.#send('heartbeat', {}, { topic: 'phoenix', joinRef: null });
      this.heartbeatCount += 1;
      if (this.heartbeatCount % 12 === 0) this.#refreshAccessToken().catch(() => this.socket?.close());
    }, HEARTBEAT_INTERVAL);
  }

  async #refreshAccessToken() {
    if (!this.socket || this.socket.readyState !== 1) return;
    const token = await this.auth.getAccessToken();
    if (token === this.accessToken) return;
    this.accessToken = token;
    this.#send('access_token', { access_token: token });
  }

  #scheduleReconnect() {
    if (!this.started || !this.eligible || this.reconnectTimer) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt += 1;
    this.#setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.refresh().catch(() => {});
    }, delay);
  }

  #disconnect(status) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.#stopHeartbeat();
    const socket = this.socket;
    const topic = this.topic;
    const joinRef = this.joinRef;
    this.socket = null;
    this.familyId = null;
    this.topic = null;
    this.joinRef = null;
    if (socket) {
      if (socket.readyState === 1) {
        const ref = this.#nextRef();
        socket.send(JSON.stringify([joinRef, ref, topic, 'phx_leave', {}]));
      }
      socket.close();
    }
    this.#setStatus(status);
  }

  #stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.heartbeatCount = 0;
  }

  #send(type, payload, options = {}) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    const topic = options.topic ?? this.topic;
    const ref = options.ref ?? this.#nextRef();
    const joinRef = options.joinRef === undefined ? this.joinRef : options.joinRef;
    this.socket.send(JSON.stringify([joinRef, ref, topic, type, payload]));
    return true;
  }

  #nextRef() { this.reference += 1; return String(this.reference); }

  #setStatus(status, error = null) {
    this.status = { status, error, familyId: this.familyId };
    this.sync.setRealtimeConnected?.(status === 'connected');
    this.onStatusChange(this.status);
  }
}

export { realtimeUrl };
