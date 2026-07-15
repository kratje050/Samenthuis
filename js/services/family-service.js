export class FamilyService {
  constructor(client, authService, onChange = () => {}) {
    this.client = client;
    this.auth = authService;
    this.onChange = onChange;
    this.context = null;
    this.members = [];
  }

  async refreshContext() {
    if (!this.auth.isSignedIn || !navigator.onLine) {
      if (!this.auth.isSignedIn) this.#setContext(null, []);
      return this.context;
    }
    const token = await this.auth.getAccessToken();
    const rows = await this.client.rpc('get_my_family_context', {}, token);
    const context = Array.isArray(rows) ? rows[0] || null : rows || null;
    let members = [];
    if (context) {
      members = await this.client.select('family_members', {
        select: 'user_id,display_name,role,joined_at',
        family_id: `eq.${context.family_id}`,
        order: 'joined_at.asc'
      }, token);
    }
    this.#setContext(context, members || []);
    return context;
  }

  async createFamily({ familyName, displayName }) {
    const token = await this.auth.getAccessToken();
    const rows = await this.client.rpc('create_family', { p_name: familyName.trim(), p_display_name: displayName.trim() }, token);
    const result = Array.isArray(rows) ? rows[0] : rows;
    await this.refreshContext();
    return result;
  }

  async joinFamily({ inviteCode, displayName }) {
    const token = await this.auth.getAccessToken();
    const rows = await this.client.rpc('join_family', { p_invite_code: inviteCode.trim().toUpperCase(), p_display_name: displayName.trim() }, token);
    const result = Array.isArray(rows) ? rows[0] : rows;
    await this.refreshContext();
    return result;
  }

  async regenerateInvite() {
    const token = await this.auth.getAccessToken();
    return this.client.rpc('regenerate_family_invite', {}, token);
  }

  clear() { this.#setContext(null, []); }

  #setContext(context, members) {
    this.context = context;
    this.members = members;
    this.onChange({ context, members });
  }
}
