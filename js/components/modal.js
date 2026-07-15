let activeCleanup;

export function closeModal() {
  activeCleanup?.();
  activeCleanup = null;
  document.querySelector('#modal-root').replaceChildren();
  document.body.style.overflow = '';
}

export function openModal({ title, content, submitLabel = 'Opslaan', cancelLabel = 'Annuleren', onSubmit, onClose, wide = false }) {
  closeModal();
  const root = document.querySelector('#modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <header class="modal-header"><button class="icon-button" type="button" data-close aria-label="Sluiten">×</button><h2 id="modal-title"></h2>${onSubmit ? `<button class="modal-save" type="submit" form="active-modal-form">${submitLabel}</button>` : '<span class="modal-header-spacer"></span>'}</header>
    <form id="active-modal-form" novalidate><div class="modal-content"></div><div class="form-error" role="alert" hidden></div>
      <footer class="modal-footer"><button class="button secondary" type="button" data-close>${cancelLabel}</button></footer>
    </form></section>`;
  backdrop.querySelector('#modal-title').textContent = title;
  const contentRoot = backdrop.querySelector('.modal-content');
  if (typeof content === 'string') contentRoot.innerHTML = content;
  else contentRoot.append(content);
  const previouslyFocused = document.activeElement;
  const keyHandler = (event) => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const focusable = [...backdrop.querySelectorAll('button, input, select, textarea, a[href]')].filter((el) => !el.disabled && !el.hidden);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop || event.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', keyHandler);
  activeCleanup = () => { document.removeEventListener('keydown', keyHandler); previouslyFocused?.focus?.(); onClose?.(); };
  if (onSubmit) backdrop.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    const error = backdrop.querySelector('.form-error');
    error.hidden = true;
    submit.disabled = true;
    try {
      const shouldClose = await onSubmit(new FormData(event.currentTarget), event.currentTarget);
      if (shouldClose !== false) closeModal();
    } catch (exception) {
      error.textContent = exception.message || 'Opslaan is niet gelukt. Probeer het opnieuw.';
      error.hidden = false;
      error.focus?.();
    } finally { submit.disabled = false; }
  });
  root.append(backdrop);
  document.body.style.overflow = 'hidden';
  queueMicrotask(() => backdrop.querySelector('input, select, textarea, button')?.focus());
  return backdrop;
}
