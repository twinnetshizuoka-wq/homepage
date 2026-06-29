export function renderProjectCard(project) {
  const features = project.features
    .map((f) => `<li>${f}</li>`)
    .join('');

  return `
    <article class="project-card fade-in" data-animate>
      <div class="project-card__icon" aria-hidden="true">${project.icon}</div>
      <h3 class="project-card__title">${project.title}</h3>
      <ul class="project-card__features">${features}</ul>
      <a href="${project.href}" class="btn btn-outline project-card__btn">詳しく見る</a>
    </article>
  `;
}

export function renderProjectGrid(projects, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = projects.map(renderProjectCard).join('');
}
