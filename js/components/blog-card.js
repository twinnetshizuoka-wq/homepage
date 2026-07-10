function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function renderBlogCard(post) {
  return `
    <article class="blog-card">
      <div class="blog-card__meta">
        <time datetime="${post.date}">${formatDate(post.date)}</time>
        <span class="blog-card__category">${post.category}</span>
      </div>
      <h2 class="blog-card__title">
        <a href="${post.href}">${post.title}</a>
      </h2>
      <p class="blog-card__excerpt">${post.excerpt}</p>
      <a href="${post.href}" class="btn btn-outline blog-card__btn">続きを読む</a>
    </article>
  `;
}

export function renderBlogList(posts, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML =
      '<p class="blog-empty">まだ記事がありません。近日中に投稿予定です。</p>';
    return;
  }

  const sorted = [...posts].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  container.innerHTML = sorted.map(renderBlogCard).join('');
}
