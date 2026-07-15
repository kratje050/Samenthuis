import {
  OUTBOX_SYNC_TAG,
  PERIODIC_SYNC_TAG,
  PERIODIC_SYNC_INTERVAL,
  registerOneOffSync,
  registerPeriodicSync,
  unregisterPeriodicSync
} from '../js/services/background-sync-service.js';
import { assert, equal } from './test-utils.js';

export const backgroundSyncTests = [
  ['Background Sync registreert de outbox voor een herhaalpoging', async () => {
    const tags = [];
    const supported = await registerOneOffSync({ sync: { register: async (tag) => tags.push(tag) } });
    assert(supported);
    equal(tags[0], OUTBOX_SYNC_TAG);
  }],
  ['Background Sync valt veilig terug bij een niet-ondersteunde browser', async () => {
    equal(await registerOneOffSync({}), false);
    equal(await registerPeriodicSync({}), false);
  }],
  ['Periodieke PWA-sync gebruikt een begrensd minimuminterval', async () => {
    let registration;
    const supported = await registerPeriodicSync({ periodicSync: { register: async (tag, options) => { registration = { tag, options }; } } });
    assert(supported);
    equal(registration.tag, PERIODIC_SYNC_TAG);
    equal(registration.options.minInterval, PERIODIC_SYNC_INTERVAL);
    assert(registration.options.minInterval >= 15 * 60 * 1000);
  }],
  ['Uitloggen schakelt de periodieke PWA-syncregistratie uit', async () => {
    let removed;
    const supported = await unregisterPeriodicSync({ periodicSync: { unregister: async (tag) => { removed = tag; } } });
    assert(supported);
    equal(removed, PERIODIC_SYNC_TAG);
  }]
];
