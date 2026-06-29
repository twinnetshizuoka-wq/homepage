import { mountLayout } from './components/layout.js';
import { renderProjectGrid } from './components/project-card.js';
import { initScrollReveal, initHeaderScroll } from './components/scroll-reveal.js';
import { initNavigation } from './utils/navigation.js';
import { projects } from './data/projects.js';

document.addEventListener('DOMContentLoaded', () => {
  mountLayout({ headerVariant: 'transparent', footerVariant: 'home' });
  renderProjectGrid(projects, 'project-grid');
  initNavigation();
  initScrollReveal();
  initHeaderScroll();
});
