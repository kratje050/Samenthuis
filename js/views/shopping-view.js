import { repositories, appState } from '../state.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { bindAction, boolValue, consumeHashAction, e, emptyState, field, handleError, numberValue, textArea, value } from './view-helpers.js';

let shoppingFilters = { query: '', category: '', state: 'open', sort: 'category' };

function shoppingForm(record = {}) {
  const members = appState.settings.members;
  return `<div class="form-grid">${field('productName','Productnaam',record,{required:true,className:'full',placeholder:'Bijvoorbeeld: melk'})}
    ${field('quantity','Aantal',record,{type:'number',min:'0',step:'0.01'})}${field('unit','Eenheid',record,{options:['stuks','pak','fles','gram','kilogram','liter','milliliter','zak','doos']})}
    ${field('category','Categorie',{category:record.category || 'Overig'},{options:appState.settings.categories.shopping})}${field('store','Winkel',record)}
    ${field('addedBy','Toegevoegd door',{addedBy:record.addedBy || members[0]?.id},{options:members.map((m)=>({value:m.id,label:m.name}))})}${textArea('note','Notitie',record,'full')}</div>`;
}

function openShoppingItem(record = null, copy = false) {
  const editing = record && !copy;
  const source = copy ? { ...record, productName: `${record.productName} (kopie)`, checked: false } : record || {};
  openModal({ title: editing ? 'Product aanpassen' : 'Product toevoegen', content: shoppingForm(source), submitLabel: editing ? 'Opslaan' : 'Toevoegen', onSubmit: async (data) => {
    const item = { productName:value(data,'productName'), quantity:numberValue(data,'quantity',1), unit:value(data,'unit'), category:value(data,'category'), store:value(data,'store'), note:value(data,'note'), addedBy:value(data,'addedBy'), checked:editing ? Boolean(record.checked) : false, checkedBy:editing ? record.checkedBy || null : null, checkedAt:editing ? record.checkedAt || null : null };
    if (!item.productName) throw new Error('Vul een productnaam in.');
    if (editing) await repositories.shopping.update(record.id,item); else await repositories.shopping.create(item);
    showToast(editing ? 'Product aangepast.' : 'Product toegevoegd.'); await refreshShopping();
  }});
}

async function refreshShopping() {
  const root = document.querySelector('#shopping-list'); if (!root) return;
  const allItems = await repositories.shopping.getAll();
  let items = [...allItems];
  const query = shoppingFilters.query.toLocaleLowerCase('nl-NL');
  items = items.filter((item) => (!query || [item.productName,item.category,item.store,item.note].join(' ').toLocaleLowerCase('nl-NL').includes(query)) && (!shoppingFilters.category || item.category === shoppingFilters.category) && (shoppingFilters.state === 'all' || (shoppingFilters.state === 'open' ? !item.checked : item.checked)));
  items.sort((a,b) => shoppingFilters.sort === 'name' ? a.productName.localeCompare(b.productName,'nl') : shoppingFilters.sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : `${a.category}${a.productName}`.localeCompare(`${b.category}${b.productName}`,'nl'));
  document.querySelector('#shopping-count').textContent = `${allItems.filter((item)=>!item.checked).length} openstaand`;
  root.innerHTML = items.length ? `<ul class="item-list">${items.map((item)=>{const member = appState.settings.members.find((m)=>m.id===item.addedBy);return `<li class="list-item ${item.checked?'is-complete':''}">
    <button class="mini-action" data-toggle-shopping="${item.id}" aria-label="${item.checked?'Opnieuw openen':'Afvinken'}">${item.checked?'↶':'✓'}</button><div class="list-item-main"><h3 class="list-item-title">${e(item.quantity || '')} ${e(item.unit || '')} ${e(item.productName)}</h3><div class="list-item-meta"><span>${e(item.category)}</span>${item.store?`<span>${e(item.store)}</span>`:''}${member?`<span>Door ${e(member.name)}</span>`:''}${item.note?`<span>${e(item.note)}</span>`:''}</div></div>
    <div class="list-actions"><button class="mini-action" data-copy-shopping="${item.id}" aria-label="Kopiëren">⧉</button><button class="mini-action" data-edit-shopping="${item.id}" aria-label="Aanpassen">✎</button><button class="mini-action danger" data-delete-shopping="${item.id}" aria-label="Verwijderen">⌫</button></div></li>`}).join('')}</ul>` : emptyState('Je lijst is leeg','Voeg toe wat bij de volgende winkelronde mee moet.','<button class="button" data-add-shopping>＋ Product toevoegen</button>');
}

export const shoppingView = {
  async render() { return `<section class="page-stack"><div class="page-header"><div><p class="muted" id="shopping-count">0 openstaand</p></div><div class="page-actions"><button class="button secondary" id="remove-checked">Afgevinkte verwijderen</button><button class="button" data-add-shopping>＋ Product</button></div></div>
    <div class="toolbar"><div class="field grow"><label for="shopping-search">Zoeken</label><input id="shopping-search" type="search" placeholder="Zoek product, winkel of notitie"></div>
    ${field('shopping-category','Categorie',{ 'shopping-category':shoppingFilters.category}, {options:[{value:'',label:'Alle categorieën'},...appState.settings.categories.shopping]})}${field('shopping-state','Status',{ 'shopping-state':shoppingFilters.state},{options:[{value:'open',label:'Openstaand'},{value:'checked',label:'Afgevinkt'},{value:'all',label:'Alles'}]})}${field('shopping-sort','Sortering',{ 'shopping-sort':shoppingFilters.sort},{options:[{value:'category',label:'Categorie'},{value:'name',label:'Naam'},{value:'newest',label:'Nieuwste'}]})}</div>
    <div id="shopping-list"></div></section>`; },
  async mount(root) {
    bindAction(root,'[data-add-shopping]',()=>openShoppingItem());
    root.querySelector('#shopping-search').addEventListener('input',async(e)=>{shoppingFilters.query=e.target.value;await refreshShopping()});
    root.querySelector('[name="shopping-category"]').addEventListener('change',async(e)=>{shoppingFilters.category=e.target.value;await refreshShopping()});
    root.querySelector('[name="shopping-state"]').addEventListener('change',async(e)=>{shoppingFilters.state=e.target.value;await refreshShopping()});
    root.querySelector('[name="shopping-sort"]').addEventListener('change',async(e)=>{shoppingFilters.sort=e.target.value;await refreshShopping()});
    bindAction(root,'[data-toggle-shopping]',async(button)=>{const item=await repositories.shopping.getById(button.dataset.toggleShopping);const member=appState.settings.members[0];await repositories.shopping.update(item.id,{checked:!item.checked,checkedAt:item.checked?null:new Date().toISOString(),checkedBy:item.checked?null:member?.id||null});showToast(item.checked?'Product heropend.':'Product afgevinkt.');await refreshShopping()});
    bindAction(root,'[data-edit-shopping]',async(button)=>{const item=await repositories.shopping.getById(button.dataset.editShopping);if(item)openShoppingItem(item)});
    bindAction(root,'[data-copy-shopping]',async(button)=>{const item=await repositories.shopping.getById(button.dataset.copyShopping);if(item)openShoppingItem(item,true)});
    bindAction(root,'[data-delete-shopping]',async(button)=>{const item=await repositories.shopping.getById(button.dataset.deleteShopping);if(item&&await confirmDialog({message:`“${e(item.productName)}” wordt verwijderd.`})){await repositories.shopping.softDelete(item.id);showToast('Product verwijderd.');await refreshShopping()}});
    root.querySelector('#remove-checked').addEventListener('click',async()=>{const checked=(await repositories.shopping.getAll()).filter((item)=>item.checked);if(!checked.length){showToast('Er zijn geen afgevinkte producten.','error');return}if(await confirmDialog({title:'Afgevinkte producten verwijderen?',message:`Je verwijdert ${checked.length} producten. Dit kan niet ongedaan worden gemaakt vanuit deze lijst.`,confirmLabel:'Alle verwijderen'})){await Promise.all(checked.map((item)=>repositories.shopping.softDelete(item.id)));showToast(`${checked.length} producten verwijderd.`);await refreshShopping()}});
    await refreshShopping().catch(handleError);
    if (consumeHashAction('1')) openShoppingItem();
  }
};
