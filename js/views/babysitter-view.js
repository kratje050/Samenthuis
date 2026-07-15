import { appState, repositories } from '../state.js';
import { openModal } from '../components/modal.js';
import { sha256 } from '../services/assistant-service.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { showToast } from '../components/toast.js';

async function selectedMoment() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  const moments = await repositories.modules.babysitting.getAll();
  return moments.find((item) => item.id === id) || moments.find((item) => item.active) || moments[0] || null;
}

function section(title, value) {
  if (!value || (Array.isArray(value) && !value.length)) return '';
  const content = Array.isArray(value) ? `<ul>${value.map((item) => `<li>${e(typeof item === 'object' ? Object.values(item).join(' · ') : item)}</li>`).join('')}</ul>` : `<p>${e(value)}</p>`;
  return `<article class="babysitter-card"><h2>${e(title)}</h2>${content}</article>`;
}

async function requestExitPin(moment) {
  if (!moment.exitPinHash) return true;
  return new Promise((resolve) => openModal({
    title: 'Oppasmodus afsluiten', content: '<div class="field"><label for="babysitter-pin">Pincode</label><input id="babysitter-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" required autofocus></div>', submitLabel: 'Afsluiten',
    onSubmit: async (data) => { if (await sha256(String(data.get('pin') || '')) !== moment.exitPinHash) throw new Error('De pincode is niet juist.'); resolve(true); },
    onClose: () => resolve(false)
  }));
}

export const babysitterView = {
  async render() {
    const moment = await selectedMoment();
    if (!moment) return `<section class="page-stack">${emptyState('Geen oppasmoment ingesteld', 'Maak onder Meer een oppasmoment en bepaal welke informatie zichtbaar is.', '<a class="button" href="#assistant?module=babysitting&new=1">Oppasmoment maken</a>')}</section>`;
    const children = (moment.childMemberIds || []).map((id) => appState.settings.members.find((member) => member.id === id)?.name).filter(Boolean).join(', ');
    return `<section class="babysitter-screen"><header><div><p class="eyebrow">Oppasmodus</p><h1>${e(moment.title)}</h1><p>${e(children || 'Gezin')} · ${e(new Date(moment.startAt).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }))} tot ${e(new Date(moment.endAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</p></div><button class="button danger" data-exit-babysitter>Oppasmodus afsluiten</button></header><div class="babysitter-grid">${section('Planning', moment.schedule)}${section('Bedtijden', moment.bedtimes)}${section('Eten en drinken', moment.food)}${section('Allergieën', moment.allergies)}${section('Medicatie', moment.medication)}${section('Noodcontacten', moment.emergencyContacts)}${section('Huisregels', moment.houseRules)}${section('Waar ligt wat?', moment.locations)}${section('Telefoonnummers', moment.phoneNumbers)}${section('Belangrijke notities', moment.notes)}</div></section>`;
  },
  async mount(root) {
    const moment = await selectedMoment();
    if (!moment) return;
    document.body.classList.add('babysitter-mode');
    if (moment.endAt && new Date(moment.endAt) <= new Date()) {
      await repositories.modules.babysitting.update(moment.id, { active: false });
      showToast('Het oppasmoment is automatisch beëindigd.'); location.hash = '#home'; return;
    }
    root.querySelector('[data-exit-babysitter]')?.addEventListener('click', async () => {
      try { if (!await requestExitPin(moment)) return; await repositories.modules.babysitting.update(moment.id, { active: false }); document.body.classList.remove('babysitter-mode'); location.hash = '#home'; } catch (error) { handleError(error); }
    });
    if (moment.endAt) {
      const delay = Math.min(2147483647, Math.max(0, new Date(moment.endAt) - new Date()));
      setTimeout(async () => { if (location.hash.startsWith('#babysitter')) { await repositories.modules.babysitting.update(moment.id, { active: false }).catch(() => {}); document.body.classList.remove('babysitter-mode'); location.hash = '#home'; } }, delay);
    }
  }
};
