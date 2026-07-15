function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

export function recipeIngredients(recipe) {
  return String(recipe.ingredients || '').split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean);
}

export function matchLeftoverRecipes(recipes, inventory, selectedIds = []) {
  const selected = inventory.filter((item) => !selectedIds.length || selectedIds.includes(item.id));
  return recipes.map((recipe) => {
    const ingredients = recipeIngredients(recipe);
    const matched = [];
    const missing = [];
    ingredients.forEach((ingredient) => {
      const ingredientName = normalize(ingredient.replace(/^\d+(?:[.,]\d+)?\s*\w*\s*/, ''));
      const item = selected.find((stock) => {
        const product = normalize(stock.productName);
        return product && ingredientName && (ingredientName.includes(product) || product.includes(ingredientName));
      });
      if (item) matched.push({ ingredient, inventoryId: item.id }); else missing.push(ingredient);
    });
    const score = ingredients.length ? matched.length / ingredients.length : 0;
    return { recipe, matched, missing, score };
  }).filter((result) => result.matched.length).sort((a, b) => b.score - a.score || a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name, 'nl'));
}

export { normalize as normalizeIngredient };
