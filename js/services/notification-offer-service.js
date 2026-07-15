import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { appState, refreshSettings, repositories, services } from '../state.js';
import { getPwaInstallState } from './pwa-install-service.js';
import { shouldOfferNotifications } from './push-notification-service.js';

const DISMISSED_UNTIL_KEY = 'samen-thuis-notification-offer-until';
const WEEK = 7 * 24 * 60 * 60 * 1000;
let started = false;

function dismissedUntil() {
  const value = Number(localStorage.getItem(DISMISSED_UNTIL_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

export function initializeNotificationOffer({ delay = 5000 } = {}) {
  if (started) return false;
  started = true;
  const attempt = async (remaining = 2) => {
    if (Date.now() < dismissedUntil()) return;
    if (document.querySelector('#modal-root')?.children.length) {
      if (remaining > 0) setTimeout(() => attempt(remaining - 1), 4500);
      return;
    }
    const install = getPwaInstallState();
    const status = await services.push.status();
    if (!shouldOfferNotifications({
      ...status,
      signedIn: services.auth.isSignedIn,
      hasFamily: Boolean(appState.cloud.family),
      platform: install.platform,
      standalone: install.standalone
    })) return;
    let enabled = false;
    openModal({
      title: 'Belangrijke meldingen ontvangen?',
      submitLabel: 'Meldingen aanzetten',
      cancelLabel: 'Later',
      content: `<p>Ontvang ook wanneer Samen Thuis gesloten is een normale melding voor afspraken, taken, medicatie, dierenarts, lage voorraad, houdbaarheid, afval, routines, incasso's en andere belangrijke gezinsmomenten.</p><p class="small muted">Android en een geïnstalleerde PWA worden ondersteund. Op iPhone werkt dit nadat Samen Thuis via Safari op het beginscherm is gezet.</p>`,
      onSubmit: async () => {
        await services.push.enable();
        await repositories.settings.save({ notifications: true });
        await refreshSettings();
        enabled = true;
        localStorage.removeItem(DISMISSED_UNTIL_KEY);
        showToast('Achtergrondmeldingen zijn ingeschakeld.');
        return true;
      },
      onClose: () => {
        if (!enabled) localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + WEEK));
      }
    });
  };
  setTimeout(() => attempt().catch(console.warn), delay);
  return true;
}
