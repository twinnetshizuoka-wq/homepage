import { mountLayout } from './components/layout.js';
import { renderProjectGrid } from './components/project-card.js';
import { renderMarketGrid } from './components/market-card.js';
import { initScrollReveal, initHeaderScroll } from './components/scroll-reveal.js';
import { initNavigation } from './utils/navigation.js';
import { projects } from './data/projects.js';
import { marketServices } from './data/market-services.js';

document.addEventListener('DOMContentLoaded', () => {
  mountLayout({ headerVariant: 'transparent', footerVariant: 'home' });
  renderProjectGrid(projects, 'project-grid');
  renderMarketGrid(marketServices, 'market-grid');
  initNavigation();
  initScrollReveal();
  initHeaderScroll();
});