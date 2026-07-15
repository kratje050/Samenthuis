import { recurrenceTests } from './recurrence-tests.js';
import { calendarTests } from './calendar-tests.js';
import { backupTests } from './backup-tests.js';
import { convenienceTests } from './convenience-tests.js';

let passed=0,failed=0;
for(const [name,test] of [...recurrenceTests,...calendarTests,...backupTests,...convenienceTests]){try{await test();console.log(`✓ ${name}`);passed++}catch(error){console.error(`✗ ${name}\n  ${error.message}`);failed++}}
console.log(`\n${passed} geslaagd, ${failed} mislukt`);
if(failed)process.exitCode=1;
