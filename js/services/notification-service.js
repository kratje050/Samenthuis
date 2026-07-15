export function notificationsSupported() { return 'Notification' in window && 'serviceWorker' in navigator; }

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export async function showNotification(title, options = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, { icon: './assets/icons/icon-192.svg', badge: './assets/icons/icon-192.svg', ...options });
  return true;
}
