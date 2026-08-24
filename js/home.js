import { mountLayout } from './components/layout.js';
import { renderProjectGrid } from './components/project-card.js';
import { renderMarketGrid } from './components/market-card.js';
import { renderBlogCard } from './components/blog-card.js';
import { initScrollReveal, initHeaderScroll } from './components/scroll-reveal.js';
import { initNavigation } from './utils/navigation.js';
import { projects } from './data/projects.js';
import { marketServices } from './data/market-services.js';
import { blogPosts } from './data/blog-posts.js';

function renderHomeBlogPreview(posts, containerId, limit = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const latest = [...posts]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);

  container.innerHTML = latest.map(renderBlogCard).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  mountLayout({ headerVariant: 'transparent', footerVariant: 'home' });
  renderProjectGrid(projects, 'project-grid');
  renderHomeBlogPreview(blogPosts, 'home-blog-list');
  renderMarketGrid(marketServices, 'market-grid');
  initNavigation();
  initScrollReveal();
  initHeaderScroll();
});