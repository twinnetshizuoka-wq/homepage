import { renderBlogList } from './components/blog-card.js';
import { blogPosts } from './data/blog-posts.js';
import { initNavigation } from './utils/navigation.js';

document.addEventListener('DOMContentLoaded', () => {
  renderBlogList(blogPosts, 'blog-list');
  initNavigation();
});
