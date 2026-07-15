import { toDateKey } from '../utils/dates.js';
export function datePicker(name, label, value = toDateKey(), { required = false, min = '', className = '' } = {}) {
  return `<div class="field ${className}"><label for="${name}">${label}${required ? ' *' : ''}</label><input id="${name}" name="${name}" type="date" value="${value || ''}" ${required ? 'required' : ''} ${min ? `min="${min}"` : ''}></div>`;
}
