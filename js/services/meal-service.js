export function parseIngredients(value = '') {
  return String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export async function addMealIngredientsToShopping(meal, shoppingRepository, addedBy = 'device') {
  const ingredients = parseIngredients(meal.ingredients);
  for (const productName of ingredients) {
    await shoppingRepository.create({
      productName, quantity: 1, unit: 'stuks', category: 'Overig', store: '',
      note: `Voor ${meal.name}`, addedBy, checked: false, checkedAt: null, checkedBy: null
    });
  }
  return ingredients.length;
}
