const frequencyPerYear = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };

export function monthlySubscriptionAmount(subscription) {
  return Number(subscription.amount || 0) * (frequencyPerYear[subscription.frequency] || 12) / 12;
}

export function subscriptionSummary(records) {
  const active = records.filter((item) => item.status === 'active');
  const monthly = active.reduce((sum, item) => sum + monthlySubscriptionAmount(item), 0);
  return { monthly, yearly: monthly * 12, count: active.length };
}

export function priceHistoryStats(records, productName = '') {
  const normalized = String(productName).trim().toLocaleLowerCase('nl-NL');
  const relevant = records.filter((item) => !normalized || String(item.productName).trim().toLocaleLowerCase('nl-NL') === normalized).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const prices = relevant.map((item) => Number(item.unitPrice || (Number(item.quantity) ? Number(item.price) / Number(item.quantity) : item.price))).filter(Number.isFinite);
  const byStore = relevant.reduce((map, item) => { const price = Number(item.unitPrice || item.price); if (!map[item.store] || price < map[item.store]) map[item.store] = price; return map; }, {});
  const stores = Object.entries(byStore).sort((a, b) => a[1] - b[1]);
  return { count: relevant.length, last: prices.at(-1) ?? 0, lowest: prices.length ? Math.min(...prices) : 0, highest: prices.length ? Math.max(...prices) : 0, cheapestStore: stores[0]?.[0] || '', byStore };
}
