export function renderMarketCard(service) {
  return `
    <article class="market-card" data-animate>
      <div class="market-card__icon" aria-hidden="true">${service.icon}</div>
      <h3 class="market-card__title">${service.title}</h3>
      <p class="market-card__description">${service.description}</p>
      <a
        href="${service.href}"
        class="btn btn-outline market-card__btn"
        target="_blank"
        rel="noopener noreferrer"
      >${service.buttonLabel}</a>
    </article>
  `;
}

export function renderMarketGrid(services, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = services.map(renderMarketCard).join('');
}
