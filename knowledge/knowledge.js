const state = {
  me: null,
  sections: [],
  articles: [],
  selectedSection: "",
  search: "",
  type: ""
};

const els = {
  sectionList: document.getElementById("section-list"),
  articleGrid: document.getElementById("article-grid"),
  searchInput: document.getElementById("search-input"),
  typeFilter: document.getElementById("type-filter"),
  listTitle: document.getElementById("list-title"),
  composeLink: document.getElementById("compose-link"),
  newArticleLink: document.getElementById("new-article-link")
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Не удалось загрузить данные.");
  }
  return data;
}

function optionalMe() {
  return fetch("/chat-api/me", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function coverStyle(url) {
  return url ? `style="--image: url('${escapeHtml(url).replace(/\)/g, "%29")}')"` : "";
}

function formatType(type) {
  return ({
    article: "Статья",
    practice: "Практика",
    knowledge: "Знание",
    guide: "Гид",
    blog: "Блог"
  })[type] || "Материал";
}

function formatDate(value) {
  if (!value) return "ещё не опубликовано";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function flattenSections(items, depth = 0, result = []) {
  for (const item of items) {
    result.push({ ...item, depth });
    flattenSections(item.children || [], depth + 1, result);
  }
  return result;
}

function renderSections() {
  const flat = flattenSections(state.sections);
  const cards = [{
    id: "all",
    slug: "",
    title: "Все разделы",
    description: "Показываем всю библиотеку материалов."
  }, ...flat];

  els.sectionList.innerHTML = cards.map((section) => `
    <article class="section-card ${section.slug === state.selectedSection ? "is-active" : ""}">
      <button type="button" data-section="${section.slug}">
        <strong>${"&nbsp;".repeat((section.depth || 0) * 2)}${escapeHtml(section.title)}</strong>
        <p>${escapeHtml(section.description || "")}</p>
      </button>
    </article>
  `).join("");

  els.sectionList.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSection = button.dataset.section || "";
      loadArticles().catch(console.error);
    });
  });
}

function renderArticles() {
  const selected = flattenSections(state.sections).find((section) => section.slug === state.selectedSection);
  els.listTitle.textContent = selected?.title || "Все материалы";

  if (!state.articles.length) {
    els.articleGrid.innerHTML = `<div class="empty-state"><strong>Пока пусто</strong><p>В этом разделе ещё нет опубликованных материалов.</p></div>`;
    return;
  }

  els.articleGrid.innerHTML = state.articles.map((article) => `
    <article class="article-card">
      <a href="/knowledge/${encodeURIComponent(article.slug)}" class="stack">
        <div class="article-card__cover" ${coverStyle(article.coverImageUrl)}></div>
        <span class="status-chip" data-status="${escapeHtml(article.status)}">${escapeHtml(formatType(article.type))}</span>
        <h3 class="panel-title">${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.excerpt || "")}</p>
        <div class="article-card__meta">
          <span>${escapeHtml(article.sectionTitle)}</span>
          <span>${escapeHtml(article.author.displayName)}</span>
          <span>${escapeHtml(formatDate(article.publishedAt || article.updatedAt))}</span>
          <span>${article.viewsCount} просмотров</span>
          <span>${article.commentsCount} комментариев</span>
        </div>
      </a>
    </article>
  `).join("");
}

async function loadArticles() {
  const params = new URLSearchParams();
  if (state.selectedSection) params.set("section", state.selectedSection);
  if (state.search) params.set("q", state.search);
  if (state.type) params.set("type", state.type);
  const data = await api(`/chat-api/knowledge/articles?${params.toString()}`);
  state.articles = data.articles || [];
  renderSections();
  renderArticles();
}

async function bootstrap() {
  const [meData, sectionData] = await Promise.all([
    optionalMe(),
    api("/chat-api/knowledge/sections")
  ]);
  state.me = meData?.user || null;
  state.sections = sectionData.sections || [];

  if (state.me) {
    els.composeLink.classList.remove("hidden");
    els.newArticleLink.classList.remove("hidden");
  }

  await loadArticles();
}

let searchTimer = null;
els.searchInput.addEventListener("input", () => {
  state.search = els.searchInput.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadArticles().catch(console.error);
  }, 220);
});

els.typeFilter.addEventListener("change", () => {
  state.type = els.typeFilter.value;
  loadArticles().catch(console.error);
});

bootstrap().catch((error) => {
  els.articleGrid.innerHTML = `<div class="empty-state"><strong>Ошибка</strong><p>${escapeHtml(error.message)}</p></div>`;
});
