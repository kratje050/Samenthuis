import { recurrenceTests } from './recurrence-tests.js';
import { calendarTests } from './calendar-tests.js';
import { backupTests } from './backup-tests.js';
import { convenienceTests } from './convenience-tests.js';
import { cloudTests } from './cloud-tests.js';
import { icsTests } from './ics-tests.js';
import { pushTests } from './push-tests.js';
import { runRepositoryTests } from './repository-tests.js';
import { DATABASE_NAME } from '../js/config.js';
import { closeDatabaseForTests } from '../js/database/indexed-db.js';

const output=document.querySelector('#test-output');let passed=0,failed=0;
async function report(name,test){const row=document.createElement('li');try{await test();row.textContent=`✓ ${name}`;row.className='pass';passed++}catch(error){row.textContent=`✗ ${name}: ${error.message}`;row.className='fail';failed++;console.error(name,error)}output.append(row)}
for(const [name,test] of [...recurrenceTests,...calendarTests,...backupTests,...convenienceTests,...cloudTests,...icsTests,...pushTests])await report(name,test);
await runRepositoryTests(report);
document.querySelector('#summary').textContent=`${passed} geslaagd, ${failed} mislukt`;
document.body.dataset.complete='true';document.body.dataset.failed=String(failed);
await closeDatabaseForTests();indexedDB.deleteDatabase(DATABASE_NAME);
