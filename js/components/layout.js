const NAV_ITEMS = [
  { href: 'index.html', label: 'ホーム', match: (path) => path.endsWith('index.html') || path.endsWith('/') },
  { href: 'index.html#projects', label: 'プロジェクト' },
  { href: 'blog.html', label: 'ブログ' },
  { href: 'about.html', label: '会社概要' },
  { href: 'contact.html', label: 'お問い合わせ' },
];

function isActive(href, currentPath) {
  if (href.includes('#')) return false;
  const file = href.split('/').pop();
  const current = currentPath.split('/').pop() || 'index.html';
  return file === current;
}

export function renderHeader({ variant = 'default' } = {}) {
  const currentPath = window.location.pathname;
  const navLinks = NAV_ITEMS.map(
    (item) =>
      `<li><a href="${item.href}" class="${isActive(item.href, currentPath) ? 'active' : ''}">${item.label}</a></li>`
  ).join('');

  return `
    <header class="site-header site-header--${variant}">
      <div class="container header-inner">
        <a href="index.html" class="logo">twin net</a>
        <button class="nav-toggle" aria-label="メニューを開く" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <nav class="main-nav">
          <ul>${navLinks}</ul>
        </nav>
      </div>
    </header>
  `;
}

export function renderFooter({ variant = 'default' } = {}) {
  return `
    <footer class="site-footer site-footer--${variant}">
      <div class="container footer-inner">
        <nav class="footer-nav" aria-label="フッターナビゲーション">
          <a href="about.html">会社概要</a>
          <a href="blog.html">ブログ</a>
          <a href="contact.html">お問い合わせ</a>
          <a href="privacy.html">プライバシーポリシー</a>
          <a href="terms.html">利用規約</a>
        </nav>
        <p class="footer-copy">&copy; twin net</p>
      </div>
    </footer>
  `;
}

export function mountLayout({ headerVariant = 'default', footerVariant = 'default' } = {}) {
  const headerEl = document.getElementById('site-header');
  const footerEl = document.getElementById('site-footer');

  if (headerEl) headerEl.innerHTML = renderHeader({ variant: headerVariant });
  if (footerEl) footerEl.innerHTML = renderFooter({ variant: footerVariant });
}
