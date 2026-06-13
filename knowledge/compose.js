const composeState = {
  me: null,
  sections: [],
  articles: [],
  current: null
};

const composeEls = {
  status: document.getElementById("compose-status"),
  mineList: document.getElementById("mine-list"),
  form: document.getElementById("compose-form"),
  id: document.getElementById("article-id"),
  title: document.getElementById("title-input"),
  type: document.getElementById("type-input"),
  section: document.getElementById("section-input"),
  statusSelect: document.getElementById("status-input"),
  excerpt: document.getElementById("excerpt-input"),
  cover: document.getElementById("cover-input"),
  coverFileInput: document.getElementById("cover-file-input"),
  coverPreview: document.getElementById("cover-preview"),
  coverUploadStatus: document.getElementById("cover-upload-status"),
  editor: document.getElementById("editor"),
  seoTitle: document.getElementById("seo-title-input"),
  seoDescription: document.getElementById("seo-description-input"),
  attachmentInput: document.getElementById("attachment-input"),
  attachmentGrid: document.getElementById("attachments-grid"),
  uploadStatus: document.getElementById("upload-status"),
  saveDraftButton: document.getElementById("save-draft-button"),
  submitReviewButton: document.getElementById("submit-review-button"),
  previewLink: document.getElementById("preview-link"),
  newArticleButton: document.getElementById("new-article-button"),
  adminLink: document.getElementById("admin-link")
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
    throw new Error(data.error || "Не удалось выполнить действие.");
  }
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(message, isError = false, target = composeEls.status) {
  target.textContent = message;
  target.classList.toggle("is-error", Boolean(isError));
}

function articleTypeLabel(type) {
  return ({
    article: "Статья",
    practice: "Практика",
    knowledge: "Знание",
    guide: "Гид",
    blog: "Блог"
  })[type] || "Материал";
}

function articleStatusLabel(status) {
  return ({
    draft: "Черновик",
    review: "На модерации",
    published: "Опубликовано",
    archived: "Архив"
  })[status] || "Без статуса";
}

function flattenSections(items, result = []) {
  for (const item of items) {
    result.push(item);
    flattenSections(item.children || [], result);
  }
  return result;
}

function renderSectionOptions() {
  const flat = flattenSections(composeState.sections);
  composeEls.section.innerHTML = `<option value="">Без раздела</option>` + flat.map((section) => `
    <option value="${section.id}">${escapeHtml(section.title)}</option>
  `).join("");
}

function renderMineList() {
  if (!composeState.articles.length) {
    composeEls.mineList.innerHTML = `<div class="empty-state"><strong>Пока нет материалов</strong><p>Создайте первый черновик и начните оформлять библиотеку.</p></div>`;
    return;
  }
  composeEls.mineList.innerHTML = composeState.articles.map((article) => `
    <article class="article-card ${composeState.current?.id === article.id ? "is-active" : ""}">
      <button class="section-link" type="button" data-article-id="${article.id}">
        <span class="status-chip" data-status="${escapeHtml(article.status)}">${escapeHtml(articleStatusLabel(article.status))}</span>
        <strong>${escapeHtml(article.title)}</strong>
        <p>${escapeHtml(article.sectionTitle || "Без раздела")} • ${escapeHtml(articleTypeLabel(article.type))}</p>
      </button>
    </article>
  `).join("");
  composeEls.mineList.querySelectorAll("[data-article-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadEditableArticle(Number(button.dataset.articleId));
    });
  });
}

function emptyArticle() {
  return {
    id: "",
    title: "",
    type: "article",
    sectionId: "",
    status: "draft",
    excerpt: "",
    coverImageUrl: "",
    contentHtml: "",
    seoTitle: "",
    seoDescription: "",
    attachments: [],
    slug: ""
  };
}

function fillForm(article) {
  composeState.current = article;
  composeEls.id.value = article.id || "";
  composeEls.title.value = article.title || "";
  composeEls.type.value = article.type || "article";
  composeEls.section.value = article.sectionId || "";
  composeEls.statusSelect.value = article.status || "draft";
  composeEls.excerpt.value = article.excerpt || "";
  composeEls.cover.value = article.coverImageUrl || "";
  composeEls.editor.innerHTML = article.contentHtml || "";
  composeEls.seoTitle.value = article.seoTitle || "";
  composeEls.seoDescription.value = article.seoDescription || "";
  composeEls.previewLink.classList.toggle("hidden", !article.slug);
  composeEls.previewLink.href = article.slug ? `/knowledge/${encodeURIComponent(article.slug)}` : "#";
  renderCoverPreview(article.coverImageUrl || "");
  renderAttachments(article.attachments || []);
  renderMineList();
}

function formPayload() {
  return {
    title: composeEls.title.value.trim(),
    type: composeEls.type.value,
    sectionId: composeEls.section.value || null,
    status: composeEls.statusSelect.value,
    excerpt: composeEls.excerpt.value.trim(),
    coverImageUrl: composeEls.cover.value.trim(),
    contentHtml: composeEls.editor.innerHTML.trim(),
    seoTitle: composeEls.seoTitle.value.trim(),
    seoDescription: composeEls.seoDescription.value.trim()
  };
}

async function loadMine() {
  const data = await api("/chat-api/knowledge/articles/mine");
  composeState.articles = data.articles || [];
  renderMineList();
}

async function loadEditableArticle(articleId) {
  const data = await api(`/chat-api/knowledge/articles/${articleId}/edit`);
  const existingIndex = composeState.articles.findIndex((item) => item.id === data.article.id);
  if (existingIndex >= 0) {
    composeState.articles[existingIndex] = data.article;
  } else {
    composeState.articles.unshift(data.article);
  }
  fillForm(data.article);
}

async function saveArticle(nextStatus = null) {
  const id = Number(composeEls.id.value || 0);
  const payload = formPayload();
  if (nextStatus) {
    payload.status = nextStatus;
  }
  const url = id ? `/chat-api/knowledge/articles/${id}` : "/chat-api/knowledge/articles";
  const method = id ? "PATCH" : "POST";
  const data = await api(url, {
    method,
    body: JSON.stringify(payload)
  });
  const article = data.article;
  const index = composeState.articles.findIndex((item) => item.id === article.id);
  if (index >= 0) {
    composeState.articles[index] = article;
  } else {
    composeState.articles.unshift(article);
  }
  fillForm(article);
  setStatus(`Материал сохранён со статусом «${articleStatusLabel(article.status)}».`);
}

function renderAttachments(items) {
  if (!items.length) {
    composeEls.attachmentGrid.innerHTML = `<div class="empty-state"><strong>Нет вложений</strong><p>Сюда можно загружать изображения, видео и файлы к статье.</p></div>`;
    return;
  }
  composeEls.attachmentGrid.innerHTML = items.map((item) => {
    const preview = item.fileKind === "image"
      ? `<img src="${item.fileUrl}" alt="${escapeHtml(item.fileName)}">`
      : item.fileKind === "video"
        ? `<video src="${item.fileUrl}" controls preload="metadata"></video>`
        : `<div class="inline-card"><strong>${escapeHtml(item.fileName)}</strong><p class="muted-copy">${escapeHtml(item.mimeType)}</p></div>`;
    return `
      <article class="attachment-card">
        ${preview}
        <a class="attachment-link" href="${item.fileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.fileName)}</a>
        <div class="detail-actions">
          <button class="action-button" type="button" data-insert="${item.id}">Вставить в текст</button>
          <button class="action-button action-button--danger" type="button" data-delete-attachment="${item.id}">Удалить</button>
        </div>
      </article>
    `;
  }).join("");

  composeEls.attachmentGrid.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
      const attachment = (composeState.current?.attachments || []).find((item) => item.id === Number(button.dataset.insert));
      if (!attachment) return;
      insertAttachmentIntoEditor(attachment);
    });
  });

  composeEls.attachmentGrid.querySelectorAll("[data-delete-attachment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const attachmentId = Number(button.dataset.deleteAttachment);
      try {
        await deleteAttachment(attachmentId);
      } catch (error) {
        setStatus(error.message, true, composeEls.uploadStatus);
      }
    });
  });
}

function renderCoverPreview(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    composeEls.coverPreview.classList.add("hidden");
    composeEls.coverPreview.innerHTML = "";
    return;
  }

  const escapedUrl = escapeHtml(safeUrl);
  composeEls.coverPreview.classList.remove("hidden");
  composeEls.coverPreview.innerHTML = `
    <img src="${escapedUrl}" alt="Обложка статьи">
    <div class="inline-card">
      <strong>Текущая обложка</strong>
      <p class="muted-copy">${escapedUrl}</p>
    </div>
  `;
}

function insertHtml(html) {
  composeEls.editor.focus();
  document.execCommand("insertHTML", false, html);
}

function insertAttachmentIntoEditor(attachment) {
  if (attachment.fileKind === "image") {
    insertHtml(`<figure><img src="${attachment.fileUrl}" alt="${escapeHtml(attachment.fileName)}"><figcaption>${escapeHtml(attachment.fileName)}</figcaption></figure>`);
    return;
  }
  if (attachment.fileKind === "video") {
    insertHtml(`<figure><video src="${attachment.fileUrl}" controls="controls" preload="metadata"></video><figcaption>${escapeHtml(attachment.fileName)}</figcaption></figure>`);
    return;
  }
  insertHtml(`<p><a href="${attachment.fileUrl}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(attachment.fileName)}</a></p>`);
}

async function uploadAttachment(file) {
  if (!file) return;
  if (!composeState.current?.id) {
    await saveArticle("draft");
  }
  const body = new FormData();
  body.append("file", file);
  setStatus("Загружаю файл...", false, composeEls.uploadStatus);
  const data = await api(`/chat-api/knowledge/articles/${composeState.current.id}/attachments`, {
    method: "POST",
    body
  });
  composeState.current.attachments = [...(composeState.current.attachments || []), data.attachment];
  renderAttachments(composeState.current.attachments);
  setStatus("Файл загружен. Можно вставить его в текст.", false, composeEls.uploadStatus);
}

async function deleteAttachment(attachmentId) {
  if (!composeState.current?.id || !attachmentId) return;
  setStatus("Удаляю вложение...", false, composeEls.uploadStatus);
  const data = await api(`/chat-api/knowledge/articles/${composeState.current.id}/attachments/${attachmentId}`, {
    method: "DELETE"
  });
  const article = data.article;
  const index = composeState.articles.findIndex((item) => item.id === article.id);
  if (index >= 0) {
    composeState.articles[index] = article;
  } else {
    composeState.articles.unshift(article);
  }
  fillForm(article);
  setStatus("Вложение удалено.", false, composeEls.uploadStatus);
}

async function uploadCover(file) {
  if (!file) return;
  if (!composeState.current?.id) {
    await saveArticle("draft");
  }
  const body = new FormData();
  body.append("file", file);
  setStatus("Загружаю обложку...", false, composeEls.coverUploadStatus);
  const data = await api(`/chat-api/knowledge/articles/${composeState.current.id}/cover`, {
    method: "POST",
    body
  });
  const article = data.article;
  const index = composeState.articles.findIndex((item) => item.id === article.id);
  if (index >= 0) {
    composeState.articles[index] = article;
  } else {
    composeState.articles.unshift(article);
  }
  fillForm(article);
  setStatus("Обложка загружена и привязана к статье.", false, composeEls.coverUploadStatus);
}

function adjustStatusOptions() {
  const isAdmin = Boolean(composeState.me?.isAdmin);
  [...composeEls.statusSelect.options].forEach((option) => {
    if (["published", "archived"].includes(option.value)) {
      option.hidden = !isAdmin;
      option.disabled = !isAdmin;
    }
  });
  composeEls.adminLink.classList.toggle("hidden", !isAdmin);
}

async function bootstrap() {
  const [meData, sectionData] = await Promise.all([
    api("/chat-api/me"),
    api("/chat-api/knowledge/sections")
  ]);
  composeState.me = meData.user;
  composeState.sections = sectionData.sections || [];
  renderSectionOptions();
  adjustStatusOptions();
  await loadMine();

  const articleId = Number(new URLSearchParams(location.search).get("id") || 0);
  if (articleId) {
    await loadEditableArticle(articleId);
    return;
  }
  fillForm(composeState.articles[0] || emptyArticle());
}

document.querySelectorAll("[data-cmd]").forEach((button) => {
  button.addEventListener("click", () => {
    composeEls.editor.focus();
    document.execCommand(button.dataset.cmd, false, null);
  });
});

document.querySelectorAll("[data-block]").forEach((button) => {
  button.addEventListener("click", () => {
    composeEls.editor.focus();
    document.execCommand("formatBlock", false, button.dataset.block);
  });
});

document.getElementById("insert-link-button").addEventListener("click", () => {
  const url = window.prompt("Введите ссылку");
  if (!url) return;
  composeEls.editor.focus();
  document.execCommand("createLink", false, url);
});

composeEls.newArticleButton.addEventListener("click", () => {
  fillForm(emptyArticle());
  setStatus("Создан новый пустой черновик. Заполните данные и сохраните.");
});

composeEls.saveDraftButton.addEventListener("click", async () => {
  try {
    await saveArticle(composeState.me?.isAdmin ? composeEls.statusSelect.value : "draft");
  } catch (error) {
    setStatus(error.message, true);
  }
});

composeEls.submitReviewButton.addEventListener("click", async () => {
  try {
    await saveArticle(composeState.me?.isAdmin ? composeEls.statusSelect.value : "review");
  } catch (error) {
    setStatus(error.message, true);
  }
});

composeEls.attachmentInput.addEventListener("change", async () => {
  try {
    await uploadAttachment(composeEls.attachmentInput.files[0]);
    composeEls.attachmentInput.value = "";
  } catch (error) {
    setStatus(error.message, true, composeEls.uploadStatus);
  }
});

composeEls.coverFileInput.addEventListener("change", async () => {
  try {
    await uploadCover(composeEls.coverFileInput.files[0]);
    composeEls.coverFileInput.value = "";
  } catch (error) {
    setStatus(error.message, true, composeEls.coverUploadStatus);
  }
});

composeEls.cover.addEventListener("input", () => {
  renderCoverPreview(composeEls.cover.value);
});

bootstrap().catch((error) => {
  setStatus(error.message, true);
});
