export function showToast(message, type = 'success', duration = 3500) {
  const root = document.querySelector('#toast-root');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  root.append(toast);
  setTimeout(() => toast.remove(), duration);
}
