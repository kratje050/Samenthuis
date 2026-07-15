import { openModal, closeModal } from './modal.js';
import { repositories } from '../state.js';
import { SearchService } from '../services/search-service.js';
import { escapeHtml } from '../utils/sanitization.js';

const searchService = new SearchService(repositories);

function renderResults(results, query) {
  if (!query.trim()) return '<div class="empty-state"><strong>Zoek in heel Samen Thuis</strong>Typ minimaal twee letters om afspraken, boodschappen, taken en alle andere onderdelen te doorzoeken.</div>';
  if (query.trim().length < 2) return '<div class="empty-state"><strong>Nog één letter</strong>Gebruik minimaal twee letters voor een gerichte zoekopdracht.</div>';
  if (!results.length) return `<div class="empty-state"><strong>Niets gevonden</strong>Er zijn geen actieve items gevonden voor “${escapeHtml(query)}”.</div>`;
  return `<ul class="item-list search-results">${results.map((result) => `<li><a class="list-item" href="#${result.route}"><span class="search-icon" aria-hidden="true">⌕</span><span class="list-item-main"><span class="badge">${escapeHtml(result.type)}</span><strong class="list-item-title">${escapeHtml(result.title)}</strong>${result.detail ? `<span class="list-item-meta">${escapeHtml(result.detail)}</span>` : ''}</span><span aria-hidden="true">›</span></a></li>`).join('')}</ul>`;
}

export function openGlobalSearch() {
  const modal = openModal({
    title: 'Zoeken in Samen Thuis',
    content: `<div class="field"><label for="global-search-input">Zoekterm</label><input id="global-search-input" type="search" autocomplete="off" placeholder="Bijvoorbeeld: zwemles, melk of dierenarts"></div><p class="small muted">Doorzoek alle actieve gezinsgegevens op dit apparaat.</p><div id="global-search-results">${renderResults([], '')}</div>`,
    onSubmit: null, wide: true
  });
  const input = modal.querySelector('#global-search-input');
  const resultsRoot = modal.querySelector('#global-search-results');
  let request = 0;
  input.addEventListener('input', async () => {
    const currentRequest = ++request;
    const query = input.value;
    if (query.trim().length < 2) { resultsRoot.innerHTML = renderResults([], query); return; }
    resultsRoot.setAttribute('aria-busy', 'true');
    const results = await searchService.search(query);
    if (currentRequest === request) { resultsRoot.innerHTML = renderResults(results, query); resultsRoot.setAttribute('aria-busy', 'false'); }
  });
  resultsRoot.addEventListener('click', (event) => { if (event.target.closest('a[href^="#"]')) closeModal(); });
}
