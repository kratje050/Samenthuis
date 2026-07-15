import { openModal, closeModal } from './modal.js';

export function confirmDialog({ title = 'Weet je het zeker?', message, confirmLabel = 'Verwijderen', danger = true }) {
  return new Promise((resolve) => {
    let decided = false;
    const modal = openModal({ title, content: `<p>${message}</p>`, onSubmit: null, onClose: () => { if (!decided) resolve(false); } });
    const footer = modal.querySelector('.modal-footer');
    footer.innerHTML = `<button class="button secondary" type="button" data-cancel>Annuleren</button><button class="button ${danger ? 'danger' : ''}" type="button" data-confirm>${confirmLabel}</button>`;
    footer.querySelector('[data-cancel]').addEventListener('click', () => { decided = true; closeModal(); resolve(false); });
    footer.querySelector('[data-confirm]').addEventListener('click', () => { decided = true; closeModal(); resolve(true); });
  });
}
