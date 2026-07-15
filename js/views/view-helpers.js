import { escapeHtml } from '../utils/sanitization.js';
import { showToast } from '../components/toast.js';

export const e = escapeHtml;

export function value(formData, name, fallback = '') { return String(formData.get(name) ?? fallback).trim(); }
export function numberValue(formData, name, fallback = 0) { const value = Number(formData.get(name)); return Number.isFinite(value) ? value : fallback; }
export function boolValue(formData, name) { return formData.has(name); }
export function arrayValue(formData, name) { return formData.getAll(name).map(String); }

export function field(name, label, record = {}, { type = 'text', required = false, placeholder = '', className = '', min = '', step = '', options = null } = {}) {
  const current = record[name] ?? '';
  if (options) return `<div class="field ${className}"><label for="${name}">${label}${required ? ' *' : ''}</label><select id="${name}" name="${name}" ${required ? 'required' : ''}>${options.map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    return `<option value="${e(item.value)}" ${String(item.value) === String(current) ? 'selected' : ''}>${e(item.label)}</option>`;
  }).join('')}</select></div>`;
  return `<div class="field ${className}"><label for="${name}">${label}${required ? ' *' : ''}</label><input id="${name}" name="${name}" type="${type}" value="${e(current)}" ${placeholder ? `placeholder="${e(placeholder)}"` : ''} ${required ? 'required' : ''} ${min !== '' ? `min="${min}"` : ''} ${step ? `step="${step}"` : ''}></div>`;
}

export function textArea(name, label, record = {}, className = '') { return `<div class="field ${className}"><label for="${name}">${label}</label><textarea id="${name}" name="${name}">${e(record[name] || '')}</textarea></div>`; }
export function check(name, label, checked = false) { return `<label class="check-row"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''}> ${label}</label>`; }

export function emptyState(title, message, action = '') { return `<div class="empty-state"><strong>${e(title)}</strong>${e(message)}${action ? `<div style="margin-top:.8rem">${action}</div>` : ''}</div>`; }

export function setBusy(button, busy = true) { if (button) { button.disabled = busy; button.setAttribute('aria-busy', String(busy)); } }

export function handleError(error) { console.error(error); showToast(error.message || 'Er ging iets mis. Probeer het opnieuw.', 'error', 5000); }

export function categoryColor(category = '') {
  const colors = ['#a86073', '#4f7770', '#b27d3d', '#7c6597', '#b45f4b', '#54739a', '#8a7047', '#9c5962'];
  let hash = 0;
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export function bindAction(root, selector, handler) {
  root.addEventListener('click', (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(target, event);
  });
}

export function consumeHashAction(action) {
  const [base, query = ''] = location.hash.split('?');
  const matches = new URLSearchParams(query).get('new') === action;
  if (matches) history.replaceState(null, '', base);
  return matches;
}
