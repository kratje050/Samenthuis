import { uuid } from './uuid.js';

const KEY = 'samen-thuis-device-id';

export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(KEY, id);
  }
  return id;
}
