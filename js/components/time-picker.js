export function timePicker(name, label, value = '', { required = false, className = '' } = {}) {
  return `<div class="field ${className}"><label for="${name}">${label}${required ? ' *' : ''}</label><input id="${name}" name="${name}" type="time" value="${value || ''}" ${required ? 'required' : ''}></div>`;
}
