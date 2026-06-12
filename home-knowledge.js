(() => {
  const showcase = document.querySelector("[data-home-knowledge]");
  if (!showcase) return;

  const panelConfigs = {
    praktiki: {
      section: "praktiki",
      allUrl: "/knowledge?section=praktiki",
      latestLabel: "Новая практика",
      popularLabel: "Популярные практики",
      empty: "Практики скоро появятся здесь."
    },
    stati: {
      section: "stati",
      allUrl: "/knowledge?section=stati",
      latestLabel: "Новая статья",
      popularLabel: "Популярные статьи",
      empty: "Статьи скоро появятся здесь."
    }
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function coverStyle(url) {
    if (!url) return "";
    const safeUrl = escapeHtml(url).replace(/\)/g, "%29");
    return `style="--image: url('${safeUrl}')"`;
  }

  function formatDate(value) {
    if (!value) return "Без даты";
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
  }

  function articleUrl(slug) {
    return `/knowledge/${encodeURIComponent(slug)}`;
  }

  function sortByPopularity(items) {
    return [...items].sort((a, b) => {
      const scoreA = Number(a.viewsCount || 0) * 3 + Number(a.commentsCount || 0) * 5 + Number(a.reactionsCount || 0) * 2;
      const scoreB = Number(b.viewsCount || 0) * 3 + Number(b.commentsCount || 0) * 5 + Number(b.reactionsCount || 0) * 2;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.publishedAt || b.updatedAt || 0) - new Date(a.publishedAt || a.updatedAt || 0);
    });
  }

  function uniqueById(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function compactList(items, featuredId) {
    return uniqueById(items)
      .filter((item) => item.id !== featuredId)
      .slice(0, 3);
  }

  function renderPanel(key, articles) {
    const config = panelConfigs[key];
    const loading = document.querySelector(`[data-home-loading="${key}"]`);
    const content = document.querySelector(`[data-home-content="${key}"]`);
    if (!content) return;

    loading?.setAttribute("hidden", "hidden");
    content.hidden = false;

    if (!articles.length) {
      content.innerHTML = `<div class="knowledge-empty">${escapeHtml(config.empty)}</div>`;
      return;
    }

    const latest = [...articles].sort((a, b) => new Date(b.publishedAt || b.updatedAt || 0) - new Date(a.publishedAt || a.updatedAt || 0))[0];
    const popular = compactList(sortByPopularity(articles), latest.id);

    const featuredMeta = [
      latest.sectionTitle,
      formatDate(latest.publishedAt || latest.updatedAt),
      `${latest.viewsCount || 0} просмотров`
    ];

    content.innerHTML = `
      <a class="knowledge-panel__featured" href="${articleUrl(latest.slug)}">
        <div class="knowledge-featured__content">
          <span class="knowledge-chip">${escapeHtml(config.latestLabel)}</span>
          <div class="knowledge-meta">${featuredMeta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          <h3>${escapeHtml(latest.title)}</h3>
          <p>${escapeHtml(latest.excerpt || "")}</p>
          <span class="text-link">Открыть материал <svg class="icon"><use href="#icon-arrow"></use></svg></span>
        </div>
        <div class="knowledge-featured__cover" ${coverStyle(latest.coverImageUrl)}></div>
      </a>
      <div class="knowledge-list">
        ${popular.length ? popular.map((article, index) => `
          <a class="knowledge-list__item" href="${articleUrl(article.slug)}">
            <span class="knowledge-list__index">${index + 1}</span>
            <div>
              <span class="knowledge-chip">${index === 0 ? escapeHtml(config.popularLabel) : "Материал"}</span>
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(article.excerpt || "")}</p>
              <div class="knowledge-meta">
                <span>${escapeHtml(formatDate(article.publishedAt || article.updatedAt))}</span>
                <span>${article.viewsCount || 0} просмотров</span>
                <span>${article.commentsCount || 0} комментариев</span>
              </div>
            </div>
            <span class="knowledge-list__arrow"><svg class="icon"><use href="#icon-arrow"></use></svg></span>
          </a>
        `).join("") : `
          <div class="knowledge-empty">Пока на главной доступен один материал. Остальные появятся по мере публикаций.</div>
        `}
      </div>
      <div class="knowledge-panel__foot">
        <div class="knowledge-panel__links">
          <a class="text-link" href="${config.allUrl}">Смотреть все <svg class="icon"><use href="#icon-arrow"></use></svg></a>
          <a class="text-link" href="${articleUrl(latest.slug)}">Перейти к новой публикации <svg class="icon"><use href="#icon-arrow"></use></svg></a>
        </div>
      </div>
    `;
  }

  async function loadPanel(key) {
    const config = panelConfigs[key];
    const response = await fetch(`/chat-api/knowledge/articles?section=${encodeURIComponent(config.section)}`, {
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error(`Не удалось загрузить раздел ${config.section}.`);
    }

    const data = await response.json();
    renderPanel(key, Array.isArray(data.articles) ? data.articles.slice(0, 12) : []);
  }

  Promise.all(Object.keys(panelConfigs).map((key) => loadPanel(key)))
    .catch((error) => {
      showcase.querySelectorAll("[data-home-loading]").forEach((node) => {
        node.textContent = error.message || "Не удалось загрузить материалы.";
      });
    });
})();
