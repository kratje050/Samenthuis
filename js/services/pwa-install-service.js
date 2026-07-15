import { closeModal, openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const OFFER_SEEN_KEY = 'samen-thuis-install-offer-seen';
const INSTALLED_KEY = 'samen-thuis-pwa-installed';
const INSTALL_READY_EVENT = 'samen-thuis-install-ready';
const INSTALL_STATE_EVENT = 'samen-thuis-install-state';

let deferredInstallPrompt = null;
let automaticOfferStarted = false;
let automaticOfferTimer = null;

export function detectInstallPlatform({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  const agent = String(userAgent).toLowerCase();
  const devicePlatform = String(platform).toLowerCase();
  if (agent.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(agent) || (devicePlatform.includes('mac') && Number(maxTouchPoints) > 1)) return 'ios';
  return 'desktop';
}

export function isRunningStandalone({ displayModeStandalone = false, navigatorStandalone = false } = {}) {
  return Boolean(displayModeStandalone || navigatorStandalone);
}

export function shouldOfferPwaInstall({ platform, standalone = false, installed = false, seen = false } = {}) {
  return (platform === 'android' || platform === 'ios') && !standalone && !installed && !seen;
}

function storageValue(storage, key) {
  try { return storage?.getItem(key) === '1'; } catch { return false; }
}

function setStorageValue(storage, key) {
  try { storage?.setItem(key, '1'); } catch { /* Opslag kan in privémodus geblokkeerd zijn. */ }
}

export function getPwaInstallState() {
  const nav = globalThis.navigator || {};
  const platform = detectInstallPlatform({
    userAgent: nav.userAgent || '',
    platform: nav.userAgentData?.platform || nav.platform || '',
    maxTouchPoints: nav.maxTouchPoints || 0
  });
  const standalone = isRunningStandalone({
    displayModeStandalone: globalThis.matchMedia?.('(display-mode: standalone)').matches,
    navigatorStandalone: nav.standalone === true
  });
  return {
    platform,
    standalone,
    installed: storageValue(globalThis.localStorage, INSTALLED_KEY),
    promptAvailable: Boolean(deferredInstallPrompt)
  };
}

function dispatchInstallState() {
  if (typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent?.(new CustomEvent(INSTALL_STATE_EVENT, { detail: getPwaInstallState() }));
}

export function installationCopy(platform, promptAvailable) {
  if (platform === 'ios') return {
    intro: 'Zet Samen Thuis op het beginscherm. Daarna opent de gezinsplanner als een gewone app en blijft hij na de eerste laadbeurt offline beschikbaar.',
    steps: [
      'Open deze website bij voorkeur in Safari.',
      'Tik onderaan op de deelknop: het vierkant met de pijl omhoog.',
      'Scroll en kies “Zet op beginscherm” of “Voeg toe aan beginscherm”.',
      'Tik rechtsboven op “Voeg toe”.'
    ],
    note: 'Een iPhone laat websites de installatie niet met één knop starten. Deze stappen zijn daarom vereist.',
    submitLabel: 'Begrepen'
  };
  if (platform === 'android' && promptAvailable) return {
    intro: 'Installeer Samen Thuis op je Android-telefoon. De app krijgt een eigen pictogram, opent volledig scherm en blijft offline bruikbaar.',
    steps: [],
    note: 'Tik op Installeren en bevestig daarna de melding van je browser.',
    submitLabel: 'Installeren'
  };
  if (platform === 'android') return {
    intro: 'Zet Samen Thuis op het startscherm zodat de gezinsplanner als een gewone app opent en offline beschikbaar blijft.',
    steps: [
      'Open het browsermenu via de drie puntjes rechtsboven.',
      'Kies “App installeren” of “Toevoegen aan startscherm”.',
      'Bevestig met “Installeren” of “Toevoegen”.'
    ],
    note: 'De exacte naam verschilt per Android-browser. Chrome en Edge ondersteunen de installatie het beste.',
    submitLabel: 'Begrepen'
  };
  return {
    intro: 'Installeer Samen Thuis via het installatiesymbool in de adresbalk of via het menu van je browser.',
    steps: ['Open het browsermenu.', 'Kies “App installeren” of “Toevoegen aan startscherm”.', 'Bevestig de installatie.'],
    note: 'De installatieoptie verschijnt alleen op een beveiligde HTTPS-website of tijdens lokaal testen.',
    submitLabel: 'Begrepen'
  };
}

export function openPwaInstallDialog({ automatic = false, platformOverride = null } = {}) {
  const state = getPwaInstallState();
  const platform = platformOverride || state.platform;
  if (state.standalone) {
    if (!automatic) showToast('Samen Thuis draait al als geïnstalleerde app.');
    return false;
  }
  if (automatic) setStorageValue(globalThis.sessionStorage, OFFER_SEEN_KEY);
  const nativePrompt = platform !== 'ios' ? deferredInstallPrompt : null;
  const copy = installationCopy(platform, Boolean(nativePrompt));
  const steps = copy.steps.length ? `<ol class="pwa-install-steps">${copy.steps.map((step) => `<li>${step}</li>`).join('')}</ol>` : '';
  openModal({
    title: 'Samen Thuis als app gebruiken?',
    cancelLabel: 'Niet nu',
    submitLabel: copy.submitLabel,
    content: `<div class="pwa-install-intro"><img src="./assets/icons/icon-192.svg" width="72" height="72" alt=""><p>${copy.intro}</p></div>${steps}<p class="small muted">${copy.note}</p>`,
    onSubmit: async () => {
      if (!nativePrompt) return true;
      deferredInstallPrompt = null;
      await nativePrompt.prompt();
      const choice = await nativePrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setStorageValue(globalThis.localStorage, INSTALLED_KEY);
        showToast('Samen Thuis wordt geïnstalleerd.');
      } else {
        showToast('Installatie is niet gestart. Je kunt dit later via Instellingen doen.');
      }
      dispatchInstallState();
      return true;
    }
  });
  return true;
}

export function initializePwaInstallOffer({ delay = 1400, fallbackDelay = 3500 } = {}) {
  if (automaticOfferStarted) return false;
  automaticOfferStarted = true;
  const state = getPwaInstallState();
  const seen = storageValue(globalThis.sessionStorage, OFFER_SEEN_KEY);
  if (!shouldOfferPwaInstall({ ...state, seen })) return false;
  const show = () => {
    clearTimeout(automaticOfferTimer);
    globalThis.removeEventListener?.(INSTALL_READY_EVENT, show);
    openPwaInstallDialog({ automatic: true });
  };
  if (state.platform === 'ios' || state.promptAvailable) {
    automaticOfferTimer = setTimeout(show, delay);
  } else {
    globalThis.addEventListener?.(INSTALL_READY_EVENT, show, { once: true });
    automaticOfferTimer = setTimeout(show, fallbackDelay);
  }
  return true;
}

function captureInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (typeof globalThis.CustomEvent === 'function') globalThis.dispatchEvent?.(new CustomEvent(INSTALL_READY_EVENT));
  dispatchInstallState();
}

globalThis.addEventListener?.('beforeinstallprompt', captureInstallPrompt);
globalThis.addEventListener?.('appinstalled', () => {
  deferredInstallPrompt = null;
  setStorageValue(globalThis.localStorage, INSTALLED_KEY);
  closeModal();
  showToast('Samen Thuis is als app geïnstalleerd.');
  dispatchInstallState();
});
