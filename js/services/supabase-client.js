import { SUPABASE } from '../config.js';

function errorMessage(status, payload) {
  const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || '';
  if (status === 400 && /invalid login/i.test(message)) return 'E-mailadres of wachtwoord is niet juist.';
  if (status === 422 && /already registered/i.test(message)) return 'Er bestaat al een account met dit e-mailadres.';
  if (status === 429) return 'Te veel pogingen. Wacht even en probeer opnieuw.';
  if (status === 401) return 'Je sessie is verlopen. Log opnieuw in.';
  return message || `De centrale dienst gaf foutcode ${status}.`;
}

export class SupabaseClient {
  constructor({ url = SUPABASE.url, publishableKey = SUPABASE.publishableKey, fetcher = globalThis.fetch } = {}) {
    this.url = url.replace(/\/$/, '');
    this.publishableKey = publishableKey;
    this.fetcher = fetcher?.bind(globalThis);
  }

  async request(path, { method = 'GET', accessToken = null, body, headers = {}, query } = {}) {
    if (!this.fetcher) throw new Error('Deze browser ondersteunt geen netwerkverzoeken.');
    const url = new URL(`${this.url}${path}`);
    Object.entries(query || {}).forEach(([key, value]) => { if (value !== undefined && value !== null) url.searchParams.set(key, String(value)); });
    let response;
    try {
      response = await this.fetcher(url, {
        method,
        headers: {
          apikey: this.publishableKey,
          Authorization: `Bearer ${accessToken || this.publishableKey}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new Error('Supabase is niet bereikbaar. Je kunt offline blijven werken.');
    }
    const text = response.status === 204 ? '' : await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) throw new Error(errorMessage(response.status, payload));
    return payload;
  }

  signUp(email, password, displayName, redirectTo) {
    return this.request('/auth/v1/signup', { method: 'POST', body: { email, password, data: { display_name: displayName } }, query: redirectTo ? { redirect_to: redirectTo } : undefined });
  }

  signIn(email, password) {
    return this.request('/auth/v1/token', { method: 'POST', query: { grant_type: 'password' }, body: { email, password } });
  }

  refreshSession(refreshToken) {
    return this.request('/auth/v1/token', { method: 'POST', query: { grant_type: 'refresh_token' }, body: { refresh_token: refreshToken } });
  }

  getUser(accessToken) { return this.request('/auth/v1/user', { accessToken }); }
  signOut(accessToken) { return this.request('/auth/v1/logout', { method: 'POST', accessToken }); }
  rpc(name, body, accessToken) { return this.request(`/rest/v1/rpc/${name}`, { method: 'POST', accessToken, body }); }
  select(table, query, accessToken) { return this.request(`/rest/v1/${table}`, { accessToken, query }); }
  invokeFunction(name, body, accessToken) { return this.request(`/functions/v1/${name}`, { method: 'POST', accessToken, body }); }
}
