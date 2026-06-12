const state = {
  articles: [],
  sections: [],
  selectedArticleId: null,
  selectedSectionId: null,
  comments: []
};

const els = {
  articleList: document.getElementById("article-list"),
  articleCount: document.getElementById("article-count"),
  detailTitle: document.getElementById("detail-title"),
  detailStatus: document.getElementById("detail-status"),
  detailAuthor: document.getElementById("detail-author"),
  detailSection: document.getElementById("detail-section"),
  detailType: document.getElementById("detail-type"),
  detailLink: document.getElementById("detail-link"),
  detailStats: document.getElementById("detail-stats"),
  detailExcerpt: document.getElementById("detail-excerpt"),
  editLink: document.getElementById("edit-link"),
  publishButton: document.getElementById("publish-button"),
  archiveButton: document.getElementById("archive-button"),
  commentList: document.getElementById("comment-list"),
  sectionForm: document.getElementById("section-form"),
  sectionParent: document.getElementById("section-parent"),
  sectionList: document.getElementById("section-list"),
  resetSection: document.getElementById("reset-section"),
  status: document.getElementById("status")
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options
  });
  if (response.status === 401) {
    location.href = "/chat";
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса.");
  }
  return data;
}

function showStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
  els.status.classList.add("is-visible");
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => els.status.classList.remove("is-visible"), 3200);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderArticles() {
  els.articleCount.textContent = `${state.articles.length} материалов`;
  els.articleList.innerHTML = state.articles.map((article) => `
    <button class="record-list__item ${state.selectedArticleId === article.id ? "is-selected" : ""}" type="button" data-article-id="${article.id}">
      <div class="record-list__row">
        <strong>${escapeHtml(article.title)}</strong>
        <span class="status-pill">${escapeHtml(article.status)}</span>
      </div>
      <span>${escapeHtml(article.sectionTitle)} • ${escapeHtml(article.author.displayName)}</span>
      <span>${article.viewsCount} просмотров • ${article.commentsCount} комментариев</span>
    </button>
  `).join("");
  els.articleList.querySelectorAll("[data-article-id]").forEach((button) => {
    button.addEventListener("click", () => selectArticle(Number(button.dataset.articleId)));
  });
}

async function selectArticle(articleId) {
  state.selectedArticleId = articleId;
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) return;
  els.detailTitle.textContent = article.title;
  els.detailStatus.textContent = article.status;
  els.detailAuthor.textContent = article.author.displayName;
  els.detailSection.textContent = article.sectionTitle;
  els.detailType.textContent = article.type;
  els.detailLink.innerHTML = `<a href="/knowledge/${encodeURIComponent(article.slug)}" target="_blank" rel="noopener noreferrer">${escapeHtml(`/knowledge/${article.slug}`)}</a>`;
  els.detailStats.textContent = `${article.viewsCount} просмотров, ${article.commentsCount} комментариев, ${article.reactionsCount} реакций`;
  els.detailExcerpt.textContent = article.excerpt || "—";
  els.editLink.href = `/knowledge/compose?id=${article.id}`;
  renderArticles();
  await loadComments(articleId);
}

async function loadComments(articleId) {
  const data = await api(`/chat-api/admin/knowledge/comments?articleId=${articleId}`);
  state.comments = data.comments || [];
  renderComments();
}

function commentMarkup(comment) {
  return `
    <article class="detail-item">
      <div>
        <strong>${escapeHtml(comment.author.displayName)}</strong>
        <span>${escapeHtml(comment.content)}</span>
        <span>${formatDate(comment.createdAt)} • ${escapeHtml(comment.status)}</span>
      </div>
      <button class="button" type="button" data-comment-status="${comment.id}" data-status="active">Показать</button>
      <button class="button" type="button" data-comment-status="${comment.id}" data-status="hidden">Скрыть</button>
    </article>
    ${(comment.replies || []).map(commentMarkup).join("")}
  `;
}

function renderComments() {
  if (!state.comments.length) {
    els.commentList.innerHTML = `<p class="record-empty">У статьи пока нет комментариев.</p>`;
    return;
  }
  els.commentList.innerHTML = state.comments.map(commentMarkup).join("");
  els.commentList.querySelectorAll("[data-comment-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/chat-api/knowledge/comments/${button.dataset.commentStatus}`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status })
        });
        await loadComments(state.selectedArticleId);
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  });
}

function flattenSections(items, result = []) {
  for (const item of items) {
    result.push(item);
    flattenSections(item.children || [], result);
  }
  return result;
}

function renderSectionOptions() {
  const flat = flattenSections(state.sections);
  els.sectionParent.innerHTML = `<option value="">Без родителя</option>` + flat.map((section) => `
    <option value="${section.id}">${escapeHtml(section.title)}</option>
  `).join("");
}

function fillSectionForm(section = null) {
  state.selectedSectionId = section?.id || null;
  const form = els.sectionForm.elements;
  form.id.value = section?.id || "";
  form.title.value = section?.title || "";
  form.slug.value = section?.slug || "";
  form.parentId.value = section?.parentId || "";
  form.sortOrder.value = section?.sortOrder ?? 0;
  form.description.value = section?.description || "";
  form.isActive.checked = section ? Boolean(section.isActive) : true;
}

function renderSections() {
  const flat = flattenSections(state.sections);
  renderSectionOptions();
  els.sectionList.innerHTML = flat.map((section) => `
    <button class="record-list__item ${state.selectedSectionId === section.id ? "is-selected" : ""}" type="button" data-section-id="${section.id}">
      <div class="record-list__row">
        <strong>${escapeHtml(section.title)}</strong>
        <span>${escapeHtml(section.slug)}</span>
      </div>
      <span>${escapeHtml(section.description || "")}</span>
    </button>
  `).join("");
  els.sectionList.querySelectorAll("[data-section-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = flat.find((item) => item.id === Number(button.dataset.sectionId));
      fillSectionForm(section);
      renderSections();
    });
  });
}

async function saveSection(event) {
  event.preventDefault();
  const form = els.sectionForm.elements;
  const payload = {
    title: form.title.value,
    slug: form.slug.value,
    parentId: form.parentId.value || null,
    sortOrder: Number(form.sortOrder.value || 0),
    description: form.description.value,
    isActive: form.isActive.checked
  };
  const id = Number(form.id.value || 0);
  const url = id ? `/chat-api/admin/knowledge/sections/${id}` : "/chat-api/admin/knowledge/sections";
  const method = id ? "PATCH" : "POST";
  const data = await api(url, {
    method,
    body: JSON.stringify(payload)
  });
  state.sections = data.sections || [];
  fillSectionForm();
  renderSections();
  showStatus("Раздел сохранён.");
}

async function setArticleStatus(status) {
  if (!state.selectedArticleId) return;
  const data = await api(`/chat-api/admin/knowledge/articles/${state.selectedArticleId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  const index = state.articles.findIndex((item) => item.id === data.article.id);
  if (index >= 0) {
    state.articles[index] = data.article;
  }
  await selectArticle(data.article.id);
  showStatus(`Статус изменён на «${status}».`);
}

async function bootstrap() {
  const data = await api("/chat-api/admin/knowledge/articles");
  state.articles = data.articles || [];
  state.sections = data.sections || [];
  renderArticles();
  renderSections();
  fillSectionForm();
  if (state.articles[0]) {
    await selectArticle(state.articles[0].id);
  }
}

els.sectionForm.addEventListener("submit", (event) => {
  saveSection(event).catch((error) => showStatus(error.message, true));
});

els.resetSection.addEventListener("click", () => {
  fillSectionForm();
  renderSections();
});

els.publishButton.addEventListener("click", () => {
  setArticleStatus("published").catch((error) => showStatus(error.message, true));
});

els.archiveButton.addEventListener("click", () => {
  setArticleStatus("archived").catch((error) => showStatus(error.message, true));
});

bootstrap().catch((error) => showStatus(error.message, true));
