import { recurrenceTests } from './recurrence-tests.js';
import { calendarTests } from './calendar-tests.js';
import { backupTests } from './backup-tests.js';
import { convenienceTests } from './convenience-tests.js';
import { cloudTests } from './cloud-tests.js';
import { icsTests } from './ics-tests.js';
import { pushTests } from './push-tests.js';
import { backgroundSyncTests } from './background-sync-tests.js';
import { pwaInstallTests } from './pwa-install-tests.js';
import { accountTests } from './account-tests.js';
import { realtimeTests } from './realtime-tests.js';

let passed=0,failed=0;
for(const [name,test] of [...recurrenceTests,...calendarTests,...backupTests,...convenienceTests,...cloudTests,...icsTests,...pushTests,...backgroundSyncTests,...pwaInstallTests,...accountTests,...realtimeTests]){try{await test();console.log(`✓ ${name}`);passed++}catch(error){console.error(`✗ ${name}\n  ${error.message}`);failed++}}
console.log(`\n${passed} geslaagd, ${failed} mislukt`);
if(failed)process.exitCode=1;
