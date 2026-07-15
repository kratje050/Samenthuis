const ICON_FILE = './assets/icons/ui-icons.svg';

export function icon(name, className = '') {
  return `<svg class="ui-icon${className ? ` ${className}` : ''}" aria-hidden="true" focusable="false"><use href="${ICON_FILE}#${name}"></use></svg>`;
}

export const ROUTE_ICONS = Object.freeze({
  home: 'home', agenda: 'calendar', shopping: 'cart', tasks: 'tasks', meals: 'meals',
  inventory: 'inventory', expenses: 'expenses', pets: 'pets', outings: 'outings',
  activity: 'activity', templates: 'templates', settings: 'settings', more: 'menu'
});
