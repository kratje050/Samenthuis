const items = [
  ['meals','♨','Maaltijden','Plan de week en bewaar recepten.'],
  ['inventory','◫','Voorraad','Bekijk tekorten en houdbaarheid.'],
  ['expenses','€','Uitgaven','Houd handmatig de maand bij.'],
  ['pets','♣','Huisdieren','Medicatie, vaccinaties en dierenarts.'],
  ['outings','⌖','Uitjes','Bewaar plannen, vakanties en ideeën.'],
  ['settings','⚙','Instellingen','Gezinsleden, back-up en voorkeuren.']
];

export const moreView = {
  async render() {
    return `<section class="page-stack"><p class="muted">Alle andere onderdelen van Samen Thuis.</p><div class="content-grid two">${items.map(([route,icon,title,description]) => `<a class="card" href="#${route}" style="text-decoration:none;color:inherit"><span class="metric" aria-hidden="true">${icon}</span><h2>${title}</h2><p class="muted">${description}</p></a>`).join('')}</div></section>`;
  }
};
