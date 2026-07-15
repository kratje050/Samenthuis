export function assert(condition, message = 'Verwachting niet voldaan') { if (!condition) throw new Error(message); }
export function equal(actual, expected, message = '') { if (actual !== expected) throw new Error(`${message || 'Waarden verschillen'}: verwacht ${expected}, kreeg ${actual}`); }
export function includes(value, expected, message = '') { if (!String(value).includes(expected)) throw new Error(`${message || 'Tekst ontbreekt'}: ${expected}`); }
