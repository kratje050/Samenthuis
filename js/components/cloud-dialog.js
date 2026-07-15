import { appState, services } from '../state.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { e } from '../views/view-helpers.js';

function errorRoot(modal) { return modal.querySelector('.form-error'); }
function showError(modal, error) { const root = errorRoot(modal); root.textContent = error.message || 'De actie is niet gelukt.'; root.hidden = false; }
function setBusy(button, busy) { button.disabled = busy; button.setAttribute('aria-busy', String(busy)); }
function formValue(modal, name) { return String(new FormData(modal.querySelector('form')).get(name) || '').trim(); }

function statusText() {
  const sync = appState.cloud.sync;
  if (!navigator.onLine) return 'Offline – wijzigingen wachten veilig op dit apparaat.';
  if (sync.status === 'syncing') return 'Bezig met synchroniseren…';
  if (sync.status === 'error') return sync.error || 'Synchronisatie is niet gelukt.';
  if (sync.lastSyncAt) return `Laatst bijgewerkt: ${new Date(sync.lastSyncAt).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}.`;
  return 'Nog niet gesynchroniseerd.';
}

function openAuthDialog() {
  const modal = openModal({
    title: 'Gezinsaccount', onSubmit: null,
    content: `<p class="muted">Log in om dezelfde gegevens veilig op meerdere telefoons te gebruiken. Zonder account blijft alles offline werken.</p>
      <div class="form-grid"><div class="field full"><label for="cloud-display-name">Jouw naam</label><input id="cloud-display-name" name="displayName" autocomplete="name" placeholder="Bijvoorbeeld Roy"></div>
      <div class="field full"><label for="cloud-email">E-mailadres</label><input id="cloud-email" name="email" type="email" autocomplete="email" required></div>
      <div class="field full"><label for="cloud-password">Wachtwoord</label><input id="cloud-password" name="password" type="password" minlength="8" autocomplete="current-password" required></div></div>
      <p class="small muted">Bij een nieuw account ontvang je mogelijk eerst een bevestigingsmail.</p>`
  });
  const footer = modal.querySelector('.modal-footer');
  footer.innerHTML = '<button class="button secondary" type="button" data-close>Annuleren</button><button class="button secondary" type="button" id="cloud-sign-up">Account maken</button><button class="button" type="button" id="cloud-sign-in">Inloggen</button>';

  modal.querySelector('#cloud-sign-in').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true); errorRoot(modal).hidden = true;
    try {
      await services.auth.signIn({ email: formValue(modal, 'email'), password: formValue(modal, 'password') });
      await services.family.refreshContext();
      showToast('Je bent ingelogd.');
      openCloudDialog();
    } catch (error) { showError(modal, error); } finally { setBusy(button, false); }
  });

  modal.querySelector('#cloud-sign-up').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true); errorRoot(modal).hidden = true;
    try {
      const displayName = formValue(modal, 'displayName');
      if (!displayName) throw new Error('Vul je naam in voor het nieuwe account.');
      const result = await services.auth.signUp({ email: formValue(modal, 'email'), password: formValue(modal, 'password'), displayName });
      if (result.confirmationRequired) {
        closeModal();
        showToast('Account gemaakt. Open de bevestigingsmail en log daarna in.', 'success', 7000);
      } else {
        await services.family.refreshContext();
        showToast('Account gemaakt en ingelogd.');
        openCloudDialog();
      }
    } catch (error) { showError(modal, error); } finally { setBusy(button, false); }
  });
}

function openFamilyDialog() {
  const defaultName = services.auth.user?.user_metadata?.display_name || appState.settings?.greetingName || '';
  const modal = openModal({
    title: 'Gezin koppelen', onSubmit: null,
    content: `<p>Je bent ingelogd als <strong>${e(services.auth.user?.email || '')}</strong>. Maak één gezamenlijk gezin of sluit aan met de code van een gezinslid.</p>
      <div class="field"><label for="family-display-name">Jouw naam binnen het gezin</label><input id="family-display-name" name="displayName" value="${e(defaultName)}" required></div>
      <hr><div class="field"><label for="family-name">Naam van het nieuwe gezin</label><input id="family-name" name="familyName" value="Samen Thuis"></div>
      <button class="button full-width" type="button" id="create-family">Nieuw gezin maken</button>
      <hr><div class="field"><label for="invite-code">Uitnodigingscode</label><input id="invite-code" name="inviteCode" autocomplete="one-time-code" autocapitalize="characters" placeholder="Bijvoorbeeld A1B2C3D4E5"></div>
      <button class="button secondary full-width" type="button" id="join-family">Met code aansluiten</button>`
  });

  modal.querySelector('#create-family').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true); errorRoot(modal).hidden = true;
    try {
      const result = await services.family.createFamily({ familyName: formValue(modal, 'familyName'), displayName: formValue(modal, 'displayName') });
      await services.sync.initializeFamily('create');
      showInviteCode(result?.invite_code);
    } catch (error) { showError(modal, error); } finally { setBusy(button, false); }
  });

  modal.querySelector('#join-family').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true); errorRoot(modal).hidden = true;
    try {
      await services.family.joinFamily({ inviteCode: formValue(modal, 'inviteCode'), displayName: formValue(modal, 'displayName') });
      await services.sync.initializeFamily('join');
      showToast('Je bent aangesloten bij het gezin.');
      openCloudDialog();
    } catch (error) { showError(modal, error); } finally { setBusy(button, false); }
  });
}

function showInviteCode(code) {
  if (!code) { openCloudDialog(); return; }
  const modal = openModal({
    title: 'Uitnodigingscode', onSubmit: null,
    content: `<p>Deel deze code alleen met iemand die toegang tot jullie gezinsgegevens mag krijgen.</p><div class="invite-code" aria-label="Uitnodigingscode">${e(code)}</div><p class="small muted">Je kunt later een nieuwe code maken; de vorige code vervalt dan direct.</p>`
  });
  const footer = modal.querySelector('.modal-footer');
  footer.innerHTML = '<button class="button secondary" type="button" id="copy-invite">Code kopiëren</button><button class="button" type="button" id="invite-done">Klaar</button>';
  modal.querySelector('#copy-invite').addEventListener('click', async () => { await navigator.clipboard.writeText(code); showToast('Uitnodigingscode gekopieerd.'); });
  modal.querySelector('#invite-done').addEventListener('click', openCloudDialog);
}

function openStatusDialog() {
  const family = appState.cloud.family;
  const members = appState.cloud.familyMembers || [];
  const sync = appState.cloud.sync;
  const modal = openModal({
    title: 'Gezinssynchronisatie', onSubmit: null,
    content: `<div class="sync-summary ${e(sync.status)}"><strong>${e(family.family_name)}</strong><span>${e(statusText())}</span><span>${sync.pending} wachtende wijziging${sync.pending === 1 ? '' : 'en'}</span></div>
      <h3>Gezinsleden met een account</h3><ul class="item-list">${members.map((member) => `<li class="list-item compact"><strong>${e(member.display_name)}</strong><span class="badge">${member.role === 'owner' ? 'Beheerder' : 'Gezinslid'}</span></li>`).join('')}</ul>
      <p class="small muted">De app blijft offline bruikbaar. Zodra internet terugkomt worden wachtende wijzigingen automatisch verwerkt.</p>`
  });
  const footer = modal.querySelector('.modal-footer');
  footer.innerHTML = `<button class="button ghost" type="button" id="cloud-sign-out">Uitloggen</button>${family.role === 'owner' ? '<button class="button secondary" type="button" id="new-invite">Nieuwe uitnodigingscode</button>' : ''}<button class="button" type="button" id="sync-now">Nu synchroniseren</button>`;
  modal.querySelector('#sync-now').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true); errorRoot(modal).hidden = true;
    try { await services.sync.sync({ reason: 'handmatig', throwOnError: true }); showToast('Alles is bijgewerkt.'); openCloudDialog(); }
    catch (error) { showError(modal, error); } finally { setBusy(button, false); }
  });
  modal.querySelector('#new-invite')?.addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true);
    try { const result = await services.family.regenerateInvite(); showInviteCode(typeof result === 'string' ? result : result?.invite_code); }
    catch (error) { showError(modal, error); } finally { setBusy(button, false); }
  });
  modal.querySelector('#cloud-sign-out').addEventListener('click', async (event) => {
    const button = event.currentTarget; setBusy(button, true);
    await services.push.disable().catch(() => {});
    await services.auth.signOut(); services.family.clear(); closeModal(); showToast('Je bent uitgelogd. Lokale gegevens blijven bewaard.');
  });
}

export function openCloudDialog() {
  if (!services.auth.isSignedIn) return openAuthDialog();
  if (!appState.cloud.family) return openFamilyDialog();
  return openStatusDialog();
}

export function cloudStatusLabel() {
  if (!services.auth.isSignedIn) return 'Alleen lokaal';
  if (!appState.cloud.family) return 'Account nog niet gekoppeld';
  const status = appState.cloud.sync.status;
  if (status === 'syncing') return 'Synchroniseren';
  if (status === 'error') return 'Synchronisatieprobleem';
  if (!navigator.onLine) return 'Offline, wijzigingen wachten';
  return 'Cloudsync actief';
}
