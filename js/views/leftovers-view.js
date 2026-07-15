import { repositories } from '../state.js';
import { matchLeftoverRecipes } from '../services/leftovers-service.js';
import { toDateKey } from '../utils/dates.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { showToast } from '../components/toast.js';

let selectedInventory = [];

function expiringSoon(item) {
  if (!item.expiryDate) return false;
  return Math.ceil((new Date(`${item.expiryDate}T12:00:00`) - new Date()) / 86400000) <= 3;
}

async function data() {
  const [inventory, meals] = await Promise.all([repositories.inventory.getAll(), repositories.meals.getAll()]);
  const recipes = meals.filter((item) => item.kind === 'recipe');
  if (!selectedInventory.length) selectedInventory = inventory.filter(expiringSoon).map((item) => item.id);
  return { inventory, recipes, matches: matchLeftoverRecipes(recipes, inventory, selectedInventory) };
}

export const leftoversView = {
  async render() {
    const { inventory, recipes, matches } = await data();
    return `<section class="page-stack leftovers-page"><div class="page-header"><div><p class="eyebrow">Eten</p><h2>Restjesplanner</h2><p class="muted">Kies wat op moet en vergelijk dit alleen met jullie eigen opgeslagen recepten.</p></div><a class="button secondary" href="#meals">Recepten beheren</a></div><section class="card"><h2>Wat is beschikbaar?</h2>${inventory.length ? `<div class="choice-grid">${inventory.map((item) => `<label class="choice-check"><input type="checkbox" data-leftover-stock="${e(item.id)}" ${selectedInventory.includes(item.id) ? 'checked' : ''}><span><strong>${e(item.productName)}</strong><small>${e(`${item.quantity} ${item.unit || ''}`)}${expiringSoon(item) ? ' · Snel opmaken' : ''}</small></span></label>`).join('')}</div>` : '<p class="muted">Voeg eerst voorraadproducten toe.</p>'}</section><section><div class="page-header"><h2>Passende recepten</h2><span class="badge">${matches.length} gevonden</span></div><div id="leftover-results">${!recipes.length ? emptyState('Nog geen recepten', 'Sla recepten met ingrediënten op in de maaltijdplanner.') : matches.length ? `<div class="content-grid two">${matches.map(({ recipe, matched, missing, score }) => `<article class="card"><div class="card-header"><div><h2>${e(recipe.name)}</h2><p class="small muted">${Math.round(score * 100)}% aanwezig · ${missing.length} ontbrekend</p></div></div><p><strong>Aanwezig:</strong> ${e(matched.map((item) => item.ingredient).join(', '))}</p><p><strong>Ontbreekt:</strong> ${e(missing.join(', ') || 'Niets')}</p><div class="page-actions"><button class="button small" data-plan-leftover="${e(recipe.id)}">Inplannen</button>${missing.length ? `<button class="button secondary small" data-shop-leftover="${e(recipe.id)}">Ontbrekend naar boodschappen</button>` : ''}<button class="button ghost small" data-use-leftover="${e(recipe.id)}">Voorraad gebruiken</button></div></article>`).join('')}</div>` : emptyState('Geen passend recept', 'Selecteer meer voorraadproducten of voeg ingrediënten aan recepten toe.')}</div></section></section>`;
  },
  async mount(root) {
    const rerender = async () => { root.innerHTML = await leftoversView.render(); };
    root.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-leftover-stock]'); if (!input) return;
      selectedInventory = input.checked ? [...new Set([...selectedInventory, input.dataset.leftoverStock])] : selectedInventory.filter((id) => id !== input.dataset.leftoverStock);
      await rerender();
    });
    root.addEventListener('click', async (event) => {
      try {
        const { inventory, recipes, matches } = await data();
        const plan = event.target.closest('[data-plan-leftover]');
        if (plan) { const recipe = recipes.find((item) => item.id === plan.dataset.planLeftover); await repositories.meals.create({ kind: 'plan', name: recipe.name, date: toDateKey(), mealType: 'dinner', ingredients: recipe.ingredients, notes: 'Gepland via de restjesplanner', favorite: false }); showToast('Restjesmaaltijd ingepland.'); }
        const shop = event.target.closest('[data-shop-leftover]');
        if (shop) { const match = matches.find((item) => item.recipe.id === shop.dataset.shopLeftover); for (const ingredient of match.missing) await repositories.shopping.create({ productName: ingredient, quantity: 1, unit: 'stuks', category: 'Overig', store: '', note: `Voor ${match.recipe.name}`, addedBy: 'device', checked: false, checkedAt: null, checkedBy: null }); showToast('Ontbrekende ingrediënten toegevoegd.'); }
        const use = event.target.closest('[data-use-leftover]');
        if (use) { const match = matches.find((item) => item.recipe.id === use.dataset.useLeftover); for (const matched of match.matched) { const stock = inventory.find((item) => item.id === matched.inventoryId); await repositories.inventory.update(stock.id, { quantity: Math.max(0, Number(stock.quantity || 0) - 1) }); } showToast('Voorraad bijgewerkt.'); return rerender(); }
      } catch (error) { handleError(error); }
    });
  }
};
