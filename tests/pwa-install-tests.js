import { detectInstallPlatform, installationCopy, isRunningStandalone, shouldOfferPwaInstall } from '../js/services/pwa-install-service.js';
import { assert, equal } from './test-utils.js';

export const pwaInstallTests = [
  ['PWA-installatie herkent een Android-telefoon', () => {
    equal(detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/137 Mobile' }), 'android');
  }],
  ['PWA-installatie herkent iPhone en iPadOS', () => {
    equal(detectInstallPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)' }), 'ios');
    equal(detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  }],
  ['PWA-installatie toont de automatische keuze alleen op mobiel', () => {
    assert(shouldOfferPwaInstall({ platform: 'android' }));
    assert(shouldOfferPwaInstall({ platform: 'ios' }));
    equal(shouldOfferPwaInstall({ platform: 'desktop' }), false);
  }],
  ['PWA-installatie vraagt niet opnieuw in standalone of dezelfde sessie', () => {
    equal(shouldOfferPwaInstall({ platform: 'android', standalone: true }), false);
    equal(shouldOfferPwaInstall({ platform: 'ios', seen: true }), false);
    equal(shouldOfferPwaInstall({ platform: 'android', installed: true }), false);
    assert(isRunningStandalone({ displayModeStandalone: true }));
    assert(isRunningStandalone({ navigatorStandalone: true }));
  }],
  ['PWA-installatie geeft werkende Android- en iPhone-instructies', () => {
    equal(installationCopy('android', true).submitLabel, 'Installeren');
    assert(installationCopy('android', false).steps.some((step) => step.includes('App installeren')));
    assert(installationCopy('ios', false).steps.some((step) => step.includes('beginscherm')));
    assert(installationCopy('ios', false).steps.some((step) => step.includes('Voeg toe')));
  }]
];
