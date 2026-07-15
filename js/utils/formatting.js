export function formatCurrency(value, currency = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(Number(value || 0));
}

export function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits }).format(Number(value || 0));
}

export function titleCase(value = '') { return value ? value[0].toUpperCase() + value.slice(1) : ''; }
