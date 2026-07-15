import { appState, refreshSettings, repositories } from '../state.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { downloadBackup, getBackupStatus } from '../services/backup-service.js';
import { importBackup, parseBackupFile } from '../services/import-service.js';
import { clearLocalData } from '../services/data-management-service.js';
import { notificationsSupported, requestNotificationPermission } from '../services/notification-service.js';
import { APP_VERSION, DATABASE_VERSION } from '../config.js';
import { e, field, handleError, value } from './view-helpers.js';
import { TrashService } from '../services/trash-service.js';

const trashService = new TrashService(repositories);

function applyTheme(theme){localStorage.setItem('samen-thuis-theme',theme);const resolved=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;document.documentElement.dataset.theme=resolved}

async function saveGeneral(form){const data=new FormData(form);const changes={theme:value(data,'theme'),dateFormat:value(data,'dateFormat'),timeFormat:value(data,'timeFormat'),currency:value(data,'currency'),greetingName:value(data,'greetingName'),weekStartsOn:Number(value(data,'weekStartsOn',1))};await repositories.settings.save(changes);await refreshSettings();applyTheme(changes.theme);showToast('Instellingen opgeslagen.')}

function memberEditor(){return appState.settings.members.map((member,index)=>`<div class="card compact form-grid"><input type="hidden" name="memberId" value="${e(member.id)}">${field(`memberName-${index}`,'Naam',{[`memberName-${index}`]:member.name},{required:true})}${field(`memberColor-${index}`,'Kleur',{[`memberColor-${index}`]:member.color},{type:'color'})}${field(`memberIcon-${index}`,'Profielicoon',{[`memberIcon-${index}`]:member.icon},{placeholder:'Letter of emoji',className:'full'})}</div>`).join('')}

async function saveMembers(form){const data=new FormData(form);const members=appState.settings.members.map((member,index)=>({...member,name:value(data,`memberName-${index}`),color:value(data,`memberColor-${index}`),icon:value(data,`memberIcon-${index}`).slice(0,4)||member.name.slice(0,1)}));if(members.some(m=>!m.name))throw new Error('Ieder gezinslid heeft een naam nodig.');await repositories.settings.save({members});await refreshSettings();showToast('Gezinsleden bijgewerkt.')}

async function saveCategories(form){const data=new FormData(form);const categories={...appState.settings.categories};for(const key of Object.keys(categories)){const list=value(data,`categories-${key}`).split(/\r?\n/).map(item=>item.trim()).filter(Boolean);if(!list.length)throw new Error('Iedere categorielijst moet minstens één categorie bevatten.');categories[key]=[...new Set(list)]}await repositories.settings.save({categories});await refreshSettings();showToast('Categorieën opgeslagen.')}

function openImportDialog(backup){openModal({title:'Back-up importeren',content:`<p>De back-up is van <strong>${e(new Date(backup.exportedAt).toLocaleString('nl-NL'))}</strong>. Kies hoe de gegevens verwerkt moeten worden.</p><div class="field"><label><input type="radio" name="importMode" value="merge" checked> Samenvoegen – per item blijft de nieuwste versie behouden</label><label><input type="radio" name="importMode" value="replace"> Vervangen – alle huidige gegevens worden eerst gewist</label></div><p class="small muted">Voor de import wordt automatisch een lokale veiligheidskopie gemaakt.</p>`,submitLabel:'Import starten',onSubmit:async data=>{const mode=value(data,'importMode');if(mode==='replace'&&!await confirmDialog({title:'Alle huidige gegevens vervangen?',message:'De huidige lokale gegevens worden verwijderd en vervangen door de back-up.',confirmLabel:'Definitief vervangen'}))return false;await importBackup(backup,mode);showToast(mode==='replace'?'Gegevens vervangen.':'Gegevens samengevoegd.');setTimeout(()=>location.reload(),700)}})}

function backupStatusText() {
  const status = getBackupStatus();
  if (!status.date) return 'Nog geen downloadbare back-up gemaakt.';
  const relative = status.daysAgo === 0 ? 'vandaag' : status.daysAgo === 1 ? 'gisteren' : `${status.daysAgo} dagen geleden`;
  return `Laatste downloadbare back-up: ${relative} (${status.date.toLocaleString('nl-NL',{dateStyle:'medium',timeStyle:'short'})}).`;
}

async function updateTrashCount() {
  const items = await trashService.getDeletedItems();
  const count = document.querySelector('#trash-count');
  if (count) count.textContent = `${items.length} verwijderd item${items.length === 1 ? '' : 's'}`;
  return items;
}

async function openTrash() {
  const items = await trashService.getDeletedItems();
  const modal = openModal({
    title: 'Centrale prullenbak', onSubmit: null, wide: true,
    content: items.length ? `<p class="muted">Herstel verwijderde gegevens naar hun oorspronkelijke onderdeel.</p><ul class="item-list" id="trash-list">${items.map((item) => `<li class="list-item"><div class="list-item-main"><span class="badge">${e(item.type)}</span><strong class="list-item-title">${e(item.title)}</strong><span class="list-item-meta">Verwijderd op ${e(new Date(item.deletedAt).toLocaleString('nl-NL',{dateStyle:'medium',timeStyle:'short'}))}</span></div><button class="button small secondary" data-trash-restore="${e(item.id)}" data-trash-entity="${e(item.entity)}">Herstellen</button></li>`).join('')}</ul>` : '<div class="empty-state"><strong>De prullenbak is leeg</strong>Er zijn geen verwijderde gegevens om te herstellen.</div>'
  });
  modal.querySelector('#trash-list')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-trash-restore]');
    if (!button) return;
    button.disabled = true;
    try {
      await trashService.restore(button.dataset.trashEntity, button.dataset.trashRestore);
      button.closest('li').remove();
      showToast('Item hersteld.');
      await updateTrashCount();
      if (!modal.querySelector('[data-trash-restore]')) modal.querySelector('.modal-content').innerHTML = '<div class="empty-state"><strong>De prullenbak is leeg</strong>Alle items zijn hersteld.</div>';
    } catch (error) { button.disabled = false; handleError(error); }
  });
}

export const settingsView={
  async render(){const settings=appState.settings;const deletedItems=await trashService.getDeletedItems();const categoryLabels={appointments:'Agenda',shopping:'Boodschappen',expenses:'Uitgaven',outings:'Uitjes'};return `<section class="page-stack">
    <form id="general-settings" class="card"><div class="card-header"><h2>Weergave en voorkeuren</h2><button class="button small" type="submit">Opslaan</button></div><div class="form-grid">${field('theme','Thema',{theme:settings.theme},{options:[{value:'light',label:'Lichte modus'},{value:'dark',label:'Donkere modus'},{value:'system',label:'Systeemthema'}]})}${field('greetingName','Naam in begroeting',settings,{options:settings.members.map(m=>({value:m.name,label:m.name}))})}${field('dateFormat','Datumformaat',settings,{options:[{value:'dd-mm-yyyy',label:'DD-MM-JJJJ'},{value:'yyyy-mm-dd',label:'JJJJ-MM-DD'}]})}${field('timeFormat','Tijdformaat',settings,{options:[{value:'24h',label:'24 uur'},{value:'12h',label:'12 uur'}]})}${field('currency','Valuta',settings,{options:[{value:'EUR',label:'Euro (€)'},{value:'USD',label:'Dollar ($)'},{value:'GBP',label:'Pond (£)'}]})}${field('weekStartsOn','Agendaweek begint op',{weekStartsOn:String(settings.weekStartsOn??1)},{options:[{value:'1',label:'Maandag'},{value:'0',label:'Zondag'}]})}</div></form>
    <form id="member-settings" class="page-stack"><div class="page-header"><h2>Gezinsleden</h2><button class="button small" type="submit">Gezinsleden opslaan</button></div><div class="content-grid two">${memberEditor()}</div></form>
    <form id="category-settings" class="card"><div class="card-header"><div><h2>Categorieën</h2><p class="small muted">Eén categorie per regel. Wijzig, voeg toe of verwijder een regel.</p></div><button class="button small" type="submit">Categorieën opslaan</button></div><div class="form-grid">${Object.entries(settings.categories).map(([key,list])=>`<div class="field"><label for="categories-${key}">${categoryLabels[key]}</label><textarea id="categories-${key}" name="categories-${key}" rows="7">${e(list.join('\n'))}</textarea></div>`).join('')}</div></form>
    <section class="card"><h2>Notificaties</h2><p class="muted">Herinneringen verschijnen tijdens gebruik altijd in de app. Met browsertoestemming kan Samen Thuis ook een lokale PWA-notificatie tonen. Een volledig gesloten browser kan zonder online pushdienst niet betrouwbaar worden gewekt.</p><button class="button secondary" id="notification-permission" ${notificationsSupported()?'':'disabled'}>${globalThis.Notification?.permission==='granted'?'Notificaties zijn toegestaan':'Notificaties toestaan'}</button></section>
    <section class="card"><div class="card-header"><div><h2>Centrale prullenbak</h2><p class="muted" id="trash-count">${deletedItems.length} verwijderd item${deletedItems.length === 1 ? '' : 's'}</p></div><button class="button secondary" id="open-trash">Prullenbak openen</button></div><p class="small muted">Verwijderde afspraken, boodschappen, taken en andere gegevens blijven lokaal bewaard en kunnen hier worden hersteld.</p></section>
    <section class="card"><h2>Back-up en herstel</h2><p class="muted">Exporteer regelmatig één volledig JSON-bestand. Bij import wordt eerst automatisch een lokale veiligheidskopie gemaakt.</p><p id="backup-status" class="badge ${getBackupStatus().stale?'high':'low'}">${e(backupStatusText())}</p><div class="page-actions"><button class="button" id="export-data">Back-up downloaden</button><label class="button secondary" for="import-file">Back-up kiezen</label><input class="sr-only" id="import-file" type="file" accept="application/json,.json"></div></section>
    <section class="card"><h2>Installatie en lokale gegevens</h2><p class="muted">Alle gegevens staan in IndexedDB op dit apparaat. Wissen van browsergegevens kan ze verwijderen.</p><div class="page-actions"><button class="button secondary" id="install-app" hidden>App installeren</button><button class="button danger" id="clear-data">Alle lokale gegevens verwijderen</button></div></section>
    <section class="card"><h2>Ontwikkelaarsinformatie</h2><dl class="small"><dt>Appversie</dt><dd>${APP_VERSION}</dd><dt>Databaseversie</dt><dd>${DATABASE_VERSION}</dd><dt>Opslag</dt><dd>IndexedDB, volledig lokaal</dd><dt>Online diensten</dt><dd>Geen</dd><dt>Fase 2</dt><dd>Outbox en synchronisatievelden voorbereid; synchronisatie is nog niet actief.</dd></dl></section>
  </section>`},
  async mount(root){
    root.querySelector('#general-settings').addEventListener('submit',event=>{event.preventDefault();saveGeneral(event.currentTarget).catch(handleError)});root.querySelector('#member-settings').addEventListener('submit',event=>{event.preventDefault();saveMembers(event.currentTarget).catch(handleError)});root.querySelector('#category-settings').addEventListener('submit',event=>{event.preventDefault();saveCategories(event.currentTarget).catch(handleError)});
    root.querySelector('#notification-permission').addEventListener('click',async()=>{const permission=await requestNotificationPermission();if(permission==='granted'){await repositories.settings.save({notifications:true});await refreshSettings();showToast('Notificaties toegestaan.')}else showToast(permission==='unsupported'?'Notificaties worden niet ondersteund.':'Notificatietoestemming is niet gegeven.','error')});
    root.querySelector('#open-trash').addEventListener('click',()=>openTrash().catch(handleError));
    root.querySelector('#export-data').addEventListener('click',async()=>{await downloadBackup();const status=root.querySelector('#backup-status');status.textContent=backupStatusText();status.className='badge low';showToast('Back-up gemaakt.')});root.querySelector('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const backup=await parseBackupFile(file);openImportDialog(backup)}catch(error){handleError(error)}finally{event.target.value=''}});
    root.querySelector('#clear-data').addEventListener('click',async()=>{if(await confirmDialog({title:'Alle lokale gegevens verwijderen?',message:'Afspraken, boodschappen, taken, maaltijden, voorraad, uitgaven, huisdieren, uitjes en instellingen worden van dit apparaat verwijderd. Maak eerst een back-up als je ze wilt bewaren.',confirmLabel:'Alles verwijderen'})){await clearLocalData();showToast('Lokale gegevens verwijderd.');setTimeout(()=>location.reload(),700)}});
    const installButton=root.querySelector('#install-app');const makeInstallable=()=>{installButton.hidden=!window.samenThuisInstallPrompt};makeInstallable();window.addEventListener('samen-thuis-install-ready',makeInstallable,{once:true});installButton.addEventListener('click',async()=>{if(!window.samenThuisInstallPrompt)return;await window.samenThuisInstallPrompt.prompt();window.samenThuisInstallPrompt=null;installButton.hidden=true})
  }
};
