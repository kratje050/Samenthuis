import { repositories } from '../state.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { applyTemplate, linesToTemplateItems, TEMPLATE_TYPES } from '../services/template-service.js';
import { bindAction, e, emptyState, field, handleError, textArea, value } from './view-helpers.js';

function templateForm(record = {}) {
  const lines = (record.items || []).map((item) => item.name).join('\n');
  return `<div class="form-grid">${field('title','Naam sjabloon',record,{required:true,className:'full',placeholder:'Bijvoorbeeld: Weekend weg'})}${field('templateType','Soort',{templateType:record.templateType||'shopping'},{options:Object.entries(TEMPLATE_TYPES).map(([value,label])=>({value,label}))})}<div class="field full"><label for="template-items">Regels, één per regel</label><textarea id="template-items" name="items" rows="10" required>${e(lines)}</textarea></div>${textArea('notes','Notities',record,'full')}</div>`;
}

function openTemplate(record = null, preset = null) {
  const source = record || preset || {};
  openModal({
    title: record ? 'Sjabloon aanpassen' : 'Nieuw sjabloon', content: templateForm(source), submitLabel: 'Sjabloon opslaan',
    onSubmit: async (data) => {
      const template = { title: value(data,'title'), templateType: value(data,'templateType'), items: linesToTemplateItems(value(data,'items')), notes: value(data,'notes') };
      if (!template.title) throw new Error('Vul een naam voor het sjabloon in.');
      if (!template.items.length) throw new Error('Voeg minimaal één regel toe.');
      if (record) await repositories.templates.update(record.id, template); else await repositories.templates.create(template);
      showToast('Sjabloon opgeslagen.'); await refreshTemplates();
    }
  });
}

async function captureShopping() {
  const items = (await repositories.shopping.getAll()).filter((item) => !item.checked);
  if (!items.length) throw new Error('Er staan geen open boodschappen om te bewaren.');
  openTemplate(null, { title: 'Vaste boodschappen', templateType: 'shopping', items: items.map((item) => ({ name: item.productName })) });
}

async function captureTasks() {
  const items = (await repositories.tasks.getAll()).filter((item) => item.status !== 'done');
  if (!items.length) throw new Error('Er staan geen open taken om te bewaren.');
  openTemplate(null, { title: 'Vaste taken', templateType: 'tasks', items: items.map((item) => ({ name: item.title })) });
}

async function refreshTemplates() {
  const root = document.querySelector('#templates-list'); if (!root) return;
  const records = (await repositories.templates.getAll()).sort((a,b)=>a.title.localeCompare(b.title,'nl'));
  root.innerHTML = records.length ? `<div class="content-grid two">${records.map((item)=>`<article class="card"><div class="card-header"><div><span class="badge">${e(TEMPLATE_TYPES[item.templateType]||item.templateType)}</span><h2>${e(item.title)}</h2></div></div><p class="muted">${item.items.length} regel${item.items.length===1?'':'s'}${item.notes?` · ${e(item.notes)}`:''}</p><div class="page-actions"><button class="button" data-apply-template="${item.id}">Gebruiken</button><button class="button secondary" data-edit-template="${item.id}">Aanpassen</button><button class="button ghost" data-delete-template="${item.id}">Verwijderen</button></div></article>`).join('')}</div>` : emptyState('Nog geen sjablonen','Bewaar een vaste boodschappenlijst, takenlijst of inpaklijst voor hergebruik.');
}

export const templatesView = {
  async render() { return `<section class="page-stack"><div class="page-header"><div><h2>Sjablonen en vaste lijstjes</h2><p class="muted">Zet veelgebruikte lijsten met één tik opnieuw klaar.</p></div><button class="button" id="new-template">＋ Nieuw sjabloon</button></div><div class="page-actions"><button class="button secondary" id="capture-shopping">Open boodschappen bewaren</button><button class="button secondary" id="capture-tasks">Open taken bewaren</button></div><div id="templates-list"></div></section>`; },
  async mount(root) {
    root.querySelector('#new-template').addEventListener('click',()=>openTemplate());
    root.querySelector('#capture-shopping').addEventListener('click',()=>captureShopping().catch(handleError));
    root.querySelector('#capture-tasks').addEventListener('click',()=>captureTasks().catch(handleError));
    bindAction(root,'[data-apply-template]',async(button)=>{const item=await repositories.templates.getById(button.dataset.applyTemplate);if(!item)return;const count=await applyTemplate(item,repositories);showToast(`${count} item${count===1?'':'s'} toegevoegd aan ${item.templateType==='shopping'?'Boodschappen':'Taken'}.`)});
    bindAction(root,'[data-edit-template]',async(button)=>{const item=await repositories.templates.getById(button.dataset.editTemplate);if(item)openTemplate(item)});
    bindAction(root,'[data-delete-template]',async(button)=>{const item=await repositories.templates.getById(button.dataset.deleteTemplate);if(item&&await confirmDialog({message:`“${e(item.title)}” wordt naar de prullenbak verplaatst.`})){await repositories.templates.softDelete(item.id);showToast('Sjabloon verwijderd.');await refreshTemplates()}});
    await refreshTemplates().catch(handleError);
  }
};
