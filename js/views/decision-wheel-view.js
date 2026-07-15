import { repositories } from '../state.js';
import { openAssistantForm } from './assistant-view.js';
import { availableChoices, pickDecision } from '../services/decision-service.js';
import { toDateKey } from '../utils/dates.js';
import { e, emptyState, handleError } from './view-helpers.js';
import { showToast } from '../components/toast.js';

async function selectedWheel() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  const wheels = await repositories.modules.decision_wheel.getAll();
  return wheels.find((item) => item.id === id) || wheels[0] || null;
}

async function useWinner(target, wheel) {
  const title = wheel.lastResult;
  if (!title) throw new Error('Draai eerst het wiel.');
  if (target === 'meal') await repositories.meals.create({ kind: 'plan', name: title, date: toDateKey(), mealType: 'dinner', ingredients: '', notes: 'Gekozen met het besliswiel', favorite: false });
  if (target === 'outing') await repositories.outings.create({ name: title, location: '', date: null, estimatedPrice: 0, website: '', travelTime: '', category: 'Overig', notes: 'Gekozen met het besliswiel', favorite: false, planned: false, completed: false });
  if (target === 'task') await repositories.tasks.create({ title, description: 'Gekozen met het besliswiel', assignedTo: '', date: toDateKey(), time: '', priority: 'normal', category: 'Gezin', recurrence: 'none', status: 'open', notes: '' });
}

export const decisionWheelView = {
  async render() {
    const wheel = await selectedWheel();
    if (!wheel) return `<section class="page-stack"><div class="page-header"><div><h2>Besliswiel</h2><p class="muted">Laat het wiel kiezen zonder AI of externe dienst.</p></div></div>${emptyState('Nog geen besliswiel', 'Maak eerst een lijst met keuzes.', '<button class="button" data-new-wheel>Besliswiel maken</button>')}</section>`;
    const choices = availableChoices(wheel);
    return `<section class="page-stack decision-page"><div class="page-header"><div><p class="eyebrow">Plannen</p><h2>${e(wheel.title)}</h2><p class="muted">${e(wheel.wheelType || 'Eigen keuzes')} · ${choices.length} beschikbare keuzes</p></div><button class="button secondary" data-edit-wheel>Keuzes aanpassen</button></div><div class="decision-layout"><div class="decision-wheel" aria-label="Besliswiel">${choices.map((choice, index) => `<span style="--choice-index:${index};--choice-count:${choices.length}">${e(choice.text)}</span>`).join('')}</div><div class="card decision-result"><p class="muted">Uitkomst</p><h2 id="decision-result">${e(wheel.lastResult || 'Nog niet gedraaid')}</h2><button class="button" data-spin-wheel>Wiel draaien</button>${wheel.lastResult ? '<div class="page-actions"><button class="button secondary small" data-use-winner="meal">Naar maaltijd</button><button class="button secondary small" data-use-winner="outing">Naar uitje</button><button class="button secondary small" data-use-winner="task">Naar taak</button></div>' : ''}</div></div></section>`;
  },
  async mount(root) {
    const rerender = async () => { root.innerHTML = await decisionWheelView.render(); };
    root.addEventListener('click', async (event) => {
      try {
        if (event.target.closest('[data-new-wheel]')) return openAssistantForm('decision_wheel', null, rerender);
        const wheel = await selectedWheel(); if (!wheel) return;
        if (event.target.closest('[data-edit-wheel]')) return openAssistantForm('decision_wheel', wheel, rerender);
        if (event.target.closest('[data-spin-wheel]')) {
          const winner = pickDecision(wheel);
          const results = [...(wheel.results || []), `${new Date().toLocaleString('nl-NL')}: ${winner.text}`].slice(-30);
          const element = root.querySelector('.decision-wheel');
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { element.classList.add('is-spinning'); setTimeout(() => element.classList.remove('is-spinning'), 700); }
          await repositories.modules.decision_wheel.update(wheel.id, { lastResult: winner.text, results });
          showToast(`Het wiel kiest: ${winner.text}`); return rerender();
        }
        const use = event.target.closest('[data-use-winner]'); if (use) { await useWinner(use.dataset.useWinner, wheel); showToast('Uitkomst toegevoegd.'); }
      } catch (error) { handleError(error); }
    });
  }
};
