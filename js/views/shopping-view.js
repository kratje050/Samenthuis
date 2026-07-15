import { repositories, appState } from '../state.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showToast } from '../components/toast.js';
import { bindAction, consumeHashAction, e, emptyState, field, handleError, numberValue, textArea, value } from './view-helpers.js';
import { accountDisplayName } from '../utils/account.js';
import { icon } from '../utils/icons.js';

let shoppingFilters = { query: '', category: '', state: 'open', sort: 'category', favorites: false };

function currentMemberId() {
  const name = accountDisplayName(appState.cloud).toLocaleLowerCase('nl-NL');
  return name ? appState.settings.members.find((member) => member.name.toLocaleLowerCase('nl-NL') === name)?.id || '' : '';
}

function shoppingForm(record = {}) {
  const members = appState.settings.members;
  return `<div class="form-grid">${field('productName', 'Productnaam', record, { required: true, className: 'full', placeholder: 'Bijvoorbeeld: melk' })}
    ${field('quantity', 'Aantal', record, { type: 'number', min: '0', step: '0.01' })}${field('unit', 'Eenheid', record, { options: ['stuks', 'pak', 'fles', 'gram', 'kilogram', 'liter', 'milliliter', 'zak', 'doos'] })}
    ${field('category', 'Categorie', { category: record.category || 'Overig' }, { options: appState.settings.categories.shopping })}${field('store', 'Winkel', record)}
    ${field('addedBy', 'Toegevoegd door', { addedBy: record.addedBy || currentMemberId() }, { options: [{ value: '', label: 'Niet opgegeven' }, ...members.map((member) => ({ value: member.id, label: member.name }))] })}
    <label class="check-row"><input name="favorite" type="checkbox" ${record.favorite ? 'checked' : ''}> Favoriet product</label>
    ${textArea('note', 'Notitie', record, 'full')}</div>`;
}

function openShoppingItem(record = null, copy = false) {
  const editing = record && !copy;
  const source = copy ? { ...record, productName: `${record.productName} (kopie)`, checked: false } : record || {};
  openModal({
    title: editing ? 'Product aanpassen' : 'Product toevoegen', content: shoppingForm(source), submitLabel: editing ? 'Opslaan' : 'Toevoegen',
    onSubmit: async (data) => {
      const item = {
        productName: value(data, 'productName'), quantity: numberValue(data, 'quantity', 1), unit: value(data, 'unit'),
        category: value(data, 'category'), store: value(data, 'store'), note: value(data, 'note'), addedBy: value(data, 'addedBy') || null,
        favorite: data.has('favorite'), checked: editing ? Boolean(record.checked) : false,
        checkedBy: editing ? record.checkedBy || null : null, checkedAt: editing ? record.checkedAt || null : null
      };
      if (!item.productName) throw new Error('Vul een productnaam in.');
      if (editing) await repositories.shopping.update(record.id, item);
      else await repositories.shopping.create(item);
      showToast(editing ? 'Product aangepast.' : 'Product toegevoegd.');
      await refreshShopping();
    }
  });
}

function shoppingRow(item) {
  const member = appState.settings.members.find((candidate) => candidate.id === item.addedBy);
  const amount = `${item.quantity || ''}${item.unit ? ` ${item.unit}` : ''}`.trim();
  return `<li class="shopping-row ${item.checked ? 'is-complete' : ''}">
    <button class="shopping-check" data-toggle-shopping="${item.id}" aria-label="${item.checked ? 'Opnieuw openen' : 'Afvinken'}">${item.checked ? icon('tasks') : ''}</button>
    <button class="shopping-row-main" type="button" data-edit-shopping="${item.id}"><strong>${e(item.productName)}</strong>${item.note || item.store || member ? `<small>${e([item.store, member ? `Door ${member.name}` : '', item.note].filter(Boolean).join(' · '))}</small>` : ''}</button>
    ${amount ? `<span class="quantity-pill">${e(amount)}</span>` : ''}
    <button class="favorite-button ${item.favorite ? 'active' : ''}" type="button" data-favorite-shopping="${item.id}" aria-label="${item.favorite ? 'Uit favorieten verwijderen' : 'Als favoriet markeren'}">☆</button>
    <details class="row-action-menu"><summary aria-label="Meer acties">${icon('more')}</summary><div><button type="button" data-copy-shopping="${item.id}">Kopiëren</button><button type="button" data-edit-shopping="${item.id}">Aanpassen</button><button type="button" class="danger" data-delete-shopping="${item.id}">Verwijderen</button></div></details>
  </li>`;
}

async function refreshShopping() {
  const root = document.querySelector('#shopping-list');
  if (!root) return;
  const allItems = await repositories.shopping.getAll();
  const query = shoppingFilters.query.toLocaleLowerCase('nl-NL');
  const items = allItems.filter((item) =>
    (!query || [item.productName, item.category, item.store, item.note].join(' ').toLocaleLowerCase('nl-NL').includes(query)) &&
    (!shoppingFilters.category || item.category === shoppingFilters.category) &&
    (!shoppingFilters.favorites || item.favorite) &&
    (shoppingFilters.state === 'all' || (shoppingFilters.state === 'open' ? !item.checked : item.checked))
  );
  items.sort((a, b) => shoppingFilters.sort === 'name' ? a.productName.localeCompare(b.productName, 'nl') : shoppingFilters.sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : `${a.category}${a.productName}`.localeCompare(`${b.category}${b.productName}`, 'nl'));
  document.querySelector('#shopping-count').textContent = `${allItems.filter((item) => !item.checked).length} openstaand`;
  root.closest('.shopping-page')?.querySelectorAll('[data-shopping-category-pill]').forEach((button) => button.classList.toggle('active', button.dataset.shoppingCategoryPill === (shoppingFilters.favorites ? 'favorites' : shoppingFilters.category)));
  if (!items.length) {
    root.innerHTML = emptyState('Je lijst is leeg', 'Voeg toe wat bij de volgende winkelronde mee moet.', '<button class="button" data-add-shopping>Product toevoegen</button>');
    return;
  }
  const groups = items.reduce((map, item) => ((map[item.category || 'Overig'] ||= []).push(item), map), {});
  root.innerHTML = Object.entries(groups).map(([category, categoryItems]) => `<section class="shopping-group"><h2>${e(category)}</h2><ul>${categoryItems.map(shoppingRow).join('')}</ul></section>`).join('');
}

export const shoppingView = {
  async render() {
    const categories = appState.settings.categories.shopping;
    const quickCategories = ['Zuivel', 'Vlees en vis', 'Groente en fruit', 'Brood'].filter((category) => categories.includes(category));
    return `<section class="page-stack shopping-page">
      <div class="shopping-pills segmented"><button type="button" data-shopping-category-pill="" class="active">Alle</button><button type="button" data-shopping-category-pill="favorites">Favorieten</button>${quickCategories.map((category) => `<button type="button" data-shopping-category-pill="${e(category)}">${e(category.replace(' en ', ' & '))}</button>`).join('')}</div>
      <div class="page-header shopping-summary"><p class="muted" id="shopping-count">0 openstaand</p><div class="page-actions"><button class="button secondary small" id="remove-checked">Afgevinkte verwijderen</button><button class="button desktop-add-shopping" data-add-shopping>${icon('plus')} Product</button></div></div>
      <details class="filter-panel"><summary>${icon('search')} Zoeken, sorteren en alle categorieën</summary><div class="toolbar"><div class="field grow"><label for="shopping-search">Zoeken</label><input id="shopping-search" type="search" placeholder="Zoek product, winkel of notitie" value="${e(shoppingFilters.query)}"></div>
        ${field('shopping-category', 'Categorie', { 'shopping-category': shoppingFilters.category }, { options: [{ value: '', label: 'Alle categorieën' }, ...categories] })}${field('shopping-state', 'Status', { 'shopping-state': shoppingFilters.state }, { options: [{ value: 'open', label: 'Openstaand' }, { value: 'checked', label: 'Afgevinkt' }, { value: 'all', label: 'Alles' }] })}${field('shopping-sort', 'Sortering', { 'shopping-sort': shoppingFilters.sort }, { options: [{ value: 'category', label: 'Categorie' }, { value: 'name', label: 'Naam' }, { value: 'newest', label: 'Nieuwste' }] })}</div></details>
      <div id="shopping-list"></div>
    </section>`;
  },

  async mount(root) {
    bindAction(root, '[data-add-shopping]', () => openShoppingItem());
    root.querySelector('#shopping-search').addEventListener('input', async (event) => { shoppingFilters.query = event.target.value; await refreshShopping(); });
    root.querySelector('[name="shopping-category"]').addEventListener('change', async (event) => { shoppingFilters.category = event.target.value; shoppingFilters.favorites = false; await refreshShopping(); });
    root.querySelector('[name="shopping-state"]').addEventListener('change', async (event) => { shoppingFilters.state = event.target.value; await refreshShopping(); });
    root.querySelector('[name="shopping-sort"]').addEventListener('change', async (event) => { shoppingFilters.sort = event.target.value; await refreshShopping(); });
    root.querySelectorAll('[data-shopping-category-pill]').forEach((button) => button.addEventListener('click', async () => {
      shoppingFilters.favorites = button.dataset.shoppingCategoryPill === 'favorites';
      shoppingFilters.category = shoppingFilters.favorites ? '' : button.dataset.shoppingCategoryPill;
      root.querySelector('[name="shopping-category"]').value = shoppingFilters.category;
      await refreshShopping();
    }));
    bindAction(root, '[data-toggle-shopping]', async (button) => {
      const item = await repositories.shopping.getById(button.dataset.toggleShopping);
      const memberId = currentMemberId();
      await repositories.shopping.update(item.id, { checked: !item.checked, checkedAt: item.checked ? null : new Date().toISOString(), checkedBy: item.checked ? null : memberId || null });
      showToast(item.checked ? 'Product heropend.' : 'Product afgevinkt.');
      await refreshShopping();
    });
    bindAction(root, '[data-favorite-shopping]', async (button) => { const item = await repositories.shopping.getById(button.dataset.favoriteShopping); await repositories.shopping.update(item.id, { favorite: !item.favorite }); await refreshShopping(); });
    bindAction(root, '[data-edit-shopping]', async (button) => { const item = await repositories.shopping.getById(button.dataset.editShopping); if (item) openShoppingItem(item); });
    bindAction(root, '[data-copy-shopping]', async (button) => { const item = await repositories.shopping.getById(button.dataset.copyShopping); if (item) openShoppingItem(item, true); });
    bindAction(root, '[data-delete-shopping]', async (button) => { const item = await repositories.shopping.getById(button.dataset.deleteShopping); if (item && await confirmDialog({ message: `“${e(item.productName)}” wordt verwijderd.` })) { await repositories.shopping.softDelete(item.id); showToast('Product verwijderd.'); await refreshShopping(); } });
    root.querySelector('#remove-checked').addEventListener('click', async () => {
      const checked = (await repositories.shopping.getAll()).filter((item) => item.checked);
      if (!checked.length) { showToast('Er zijn geen afgevinkte producten.', 'error'); return; }
      if (await confirmDialog({ title: 'Afgevinkte producten verwijderen?', message: `Je verwijdert ${checked.length} producten.`, confirmLabel: 'Alle verwijderen' })) {
        await Promise.all(checked.map((item) => repositories.shopping.softDelete(item.id)));
        showToast(`${checked.length} producten verwijderd.`); await refreshShopping();
      }
    });
    await refreshShopping().catch(handleError);
    if (consumeHashAction('1')) openShoppingItem();
  }
};
