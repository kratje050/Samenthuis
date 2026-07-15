const SESSION_KEY = 'supabase-session';

function normalizedSession(payload) {
  if (!payload?.access_token) return null;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Number(payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600)),
    tokenType: payload.token_type || 'bearer',
    user: payload.user || null
  };
}

export class AuthService {
  constructor(client, cloudRepository, onChange = () => {}) {
    this.client = client;
    this.cloudRepository = cloudRepository;
    this.onChange = onChange;
    this.session = null;
    this.initialized = false;
    this.refreshPromise = null;
  }

  async initialize() {
    this.session = await this.cloudRepository.get(SESSION_KEY);
    if (this.session && navigator.onLine) {
      try {
        const token = await this.getAccessToken();
        const result = await this.client.getUser(token);
        this.session.user = result?.user || result || this.session.user;
        await this.#save(this.session);
      } catch {
        if (Number(this.session.expiresAt || 0) <= Math.floor(Date.now() / 1000)) await this.#clear();
      }
    }
    this.initialized = true;
    this.#notify();
    return this.session;
  }

  async signUp({ email, password, displayName }) {
    if (password.length < 8) throw new Error('Gebruik een wachtwoord van minimaal 8 tekens.');
    const payload = await this.client.signUp(email.trim(), password, displayName.trim(), `${location.origin}${location.pathname}`);
    const session = normalizedSession(payload);
    if (session) await this.#save(session);
    return { session, confirmationRequired: !session, user: payload?.user || null };
  }

  async signIn({ email, password }) {
    const session = normalizedSession(await this.client.signIn(email.trim(), password));
    if (!session) throw new Error('Inloggen is niet gelukt.');
    await this.#save(session);
    return session;
  }

  async signOut() {
    const token = this.session?.accessToken;
    if (token && navigator.onLine) await this.client.signOut(token).catch(() => {});
    await this.#clear();
  }

  async getAccessToken() {
    if (!this.session) throw new Error('Log eerst in om te synchroniseren.');
    if (Number(this.session.expiresAt || 0) > Math.floor(Date.now() / 1000) + 60) return this.session.accessToken;
    if (!navigator.onLine) throw new Error('Je sessie moet online worden vernieuwd. Lokale gegevens blijven beschikbaar.');
    if (!this.refreshPromise) {
      this.refreshPromise = this.client.refreshSession(this.session.refreshToken)
        .then((payload) => this.#save(normalizedSession(payload)))
        .finally(() => { this.refreshPromise = null; });
    }
    const session = await this.refreshPromise;
    return session.accessToken;
  }

  get user() { return this.session?.user || null; }
  get isSignedIn() { return Boolean(this.session?.accessToken); }

  async #save(session) {
    if (!session) throw new Error('De ontvangen sessie is ongeldig.');
    this.session = session;
    await this.cloudRepository.set(SESSION_KEY, session);
    this.#notify();
    return session;
  }

  async #clear() {
    this.session = null;
    await this.cloudRepository.remove(SESSION_KEY);
    this.#notify();
  }

  #notify() { this.onChange({ signedIn: this.isSignedIn, user: this.user, session: this.session }); }
}
