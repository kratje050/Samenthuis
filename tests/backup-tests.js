import { validateBackup } from '../js/services/validation-service.js';
import { APP_NAME, DATABASE_VERSION, SETTINGS_ID } from '../js/config.js';
import { assert } from './test-utils.js';

const valid={appName:APP_NAME,appVersion:'1.0.0',databaseVersion:DATABASE_VERSION,exportedAt:new Date().toISOString(),deviceId:'test',instellingen:{id:SETTINGS_ID},gezinsleden:[],afspraken:[],boodschappen:[],taken:[],maaltijden:[],voorraad:[],uitgaven:[],huisdieren:[],uitjes:[],outbox:[]};
export const backupTests=[
  ['geldige back-up wordt geaccepteerd',()=>assert(validateBackup(structuredClone(valid),{appName:APP_NAME,databaseVersion:DATABASE_VERSION}))],
  ['verkeerde app wordt geweigerd',()=>{let failed=false;try{validateBackup({...structuredClone(valid),appName:'Andere app'},{appName:APP_NAME,databaseVersion:DATABASE_VERSION})}catch{failed=true}assert(failed)}],
  ['ontbrekende sectie wordt geweigerd',()=>{const invalid=structuredClone(valid);delete invalid.taken;let failed=false;try{validateBackup(invalid,{appName:APP_NAME,databaseVersion:DATABASE_VERSION})}catch{failed=true}assert(failed)}],
  ['ongeldige outbox-ID wordt geweigerd',()=>{const invalid=structuredClone(valid);invalid.outbox=[{changeId:'geen-uuid',recordId:SETTINGS_ID}];let failed=false;try{validateBackup(invalid,{appName:APP_NAME,databaseVersion:DATABASE_VERSION})}catch{failed=true}assert(failed)}]
];
