const REACTIONS = [
  { key: "heart", label: "❤" },
  { key: "useful", label: "Полезно" },
  { key: "fire", label: "Огонь" },
  { key: "support", label: "Поддерживаю" },
  { key: "insight", label: "Инсайт" }
];

const state = {
  me: null,
  article: null
};

const els = {
  title: document.getElementById("article-title"),
  eyebrow: document.getElementById("article-eyebrow"),
  meta: document.getElementById("article-meta"),
  cover: document.getElementById("article-cover"),
  body: document.getElementById("article-body"),
  articleReactions: document.getElementById("article-reactions"),
  attachments: document.getElementById("attachments-grid"),
  comments: document.getElementById("comments-list"),
  commentForm: document.getElementById("comment-form"),
  commentContent: document.getElementById("comment-content"),
  commentStatus: document.getElementById("comment-status"),
  parentCommentId: document.getElementById("parent-comment-id"),
  cancelReplyButton: document.getElementById("cancel-reply-button"),
  loginLink: document.getElementById("login-link"),
  composeLink: document.getElementById("compose-link"),
  shareButton: document.getElementById("share-button")
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса.");
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

function formatDate(value) {
  if (!value) return "не опубликовано";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

function mergeReactions(items) {
  return REACTIONS.map((reaction) => {
    const existing = (items || []).find((item) => item.reaction === reaction.key);
    return {
      ...reaction,
      count: existing?.count || 0,
      reacted: Boolean(existing?.reacted)
    };
  });
}

function renderArticle() {
  const article = state.article;
  document.title = `${article.title} | Лавка Шамана`;
  els.title.textContent = article.title;
  els.eyebrow.textContent = `${formatType(article.type)} • ${article.sectionTitle}`;
  els.meta.innerHTML = `
    <span>${escapeHtml(article.author.displayName)}</span>
    <span>${escapeHtml(formatDate(article.publishedAt || article.updatedAt))}</span>
    <span>${article.viewsCount} просмотров</span>
    <span>${article.commentsCount} комментариев</span>
  `;
  if (article.coverImageUrl) {
    els.cover.classList.remove("hidden");
    els.cover.style.setProperty("--image", `url('${article.coverImageUrl.replace(/\)/g, "%29")}')`);
  }
  els.body.innerHTML = article.contentHtml || "<p>Текст статьи пока пуст.</p>";
  renderArticleReactions();
  renderAttachments();
  renderComments();
}

function renderArticleReactions() {
  const items = mergeReactions(state.article.reactions);
  els.articleReactions.innerHTML = items.map((reaction) => `
    <button type="button" class="reaction-button ${reaction.reacted ? "is-active" : ""}" data-article-reaction="${reaction.key}">
      <span>${reaction.label}</span>
      <strong>${reaction.count}</strong>
    </button>
  `).join("");
  els.articleReactions.querySelectorAll("[data-article-reaction]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.me) {
        els.commentStatus.textContent = "Нужен вход в аккаунт, чтобы ставить реакции.";
        els.commentStatus.classList.add("is-error");
        return;
      }
      try {
        const data = await api(`/chat-api/knowledge/articles/${state.article.id}/reactions`, {
          method: "POST",
          body: JSON.stringify({ reaction: button.dataset.articleReaction })
        });
        state.article.reactions = data.reactions || [];
        renderArticleReactions();
      } catch (error) {
        els.commentStatus.textContent = error.message;
        els.commentStatus.classList.add("is-error");
      }
    });
  });
}

function renderAttachments() {
  const attachments = state.article.attachments || [];
  if (!attachments.length) {
    els.attachments.innerHTML = `<div class="empty-state"><strong>Нет вложений</strong><p>К этой статье пока не прикрепляли файлы.</p></div>`;
    return;
  }
  els.attachments.innerHTML = attachments.map((item) => {
    const preview = item.fileKind === "image"
      ? `<img src="${item.fileUrl}" alt="${escapeHtml(item.fileName)}">`
      : item.fileKind === "video"
        ? `<video src="${item.fileUrl}" controls preload="metadata"></video>`
        : `<div class="inline-card"><strong>${escapeHtml(item.fileName)}</strong><p class="muted-copy">${escapeHtml(item.mimeType || "Файл")}</p></div>`;
    return `
      <article class="attachment-card">
        ${preview}
        <a class="attachment-link" href="${item.fileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.fileName)}</a>
        <div class="attachment-meta">
          <span>${escapeHtml(item.fileKind)}</span>
          <span>${Math.max(1, Math.round((item.fileSize || 0) / 1024))} КБ</span>
        </div>
      </article>
    `;
  }).join("");
}

function commentActions(comment) {
  const actions = [];
  if (state.me) {
    actions.push(`<button class="action-button" type="button" data-reply="${comment.id}">Ответить</button>`);
  }
  if (comment.permissions?.canEdit || comment.permissions?.canModerate) {
    actions.push(`<button class="action-button action-button--danger" type="button" data-delete-comment="${comment.id}">Скрыть</button>`);
  }
  return actions.join("");
}

function reactionRow(items, commentId) {
  return mergeReactions(items).map((reaction) => `
    <button type="button" class="reaction-button ${reaction.reacted ? "is-active" : ""}" data-comment-reaction="${commentId}" data-reaction="${reaction.key}">
      <span>${reaction.label}</span>
      <strong>${reaction.count}</strong>
    </button>
  `).join("");
}

function commentTemplate(comment) {
  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong class="comment-author">${escapeHtml(comment.author.displayName)}</strong>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
        <span class="status-chip" data-status="${escapeHtml(comment.status)}">${escapeHtml(comment.status)}</span>
      </div>
      <div>${escapeHtml(comment.content).replace(/\n/g, "<br>")}</div>
      <div class="comment-reactions">${reactionRow(comment.reactions, comment.id)}</div>
      <div class="comment-actions">${commentActions(comment)}</div>
      ${(comment.replies || []).length ? `<div class="reply-list">${comment.replies.map(commentTemplate).join("")}</div>` : ""}
    </article>
  `;
}

function bindCommentInteractions() {
  els.comments.querySelectorAll("[data-reply]").forEach((button) => {
    button.addEventListener("click", () => {
      els.parentCommentId.value = button.dataset.reply;
      els.cancelReplyButton.classList.remove("hidden");
      els.commentContent.focus();
      els.commentStatus.textContent = "Вы пишете ответ на комментарий.";
      els.commentStatus.classList.remove("is-error");
    });
  });
  els.comments.querySelectorAll("[data-delete-comment]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const data = await api(`/chat-api/knowledge/comments/${button.dataset.deleteComment}`, {
          method: "DELETE"
        });
        state.article.comments = data.comments || [];
        renderComments();
      } catch (error) {
        els.commentStatus.textContent = error.message;
        els.commentStatus.classList.add("is-error");
      }
    });
  });
  els.comments.querySelectorAll("[data-comment-reaction]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.me) {
        els.commentStatus.textContent = "Нужен вход в аккаунт, чтобы ставить реакции.";
        els.commentStatus.classList.add("is-error");
        return;
      }
      try {
        const data = await api(`/chat-api/knowledge/comments/${button.dataset.commentReaction}/reactions`, {
          method: "POST",
          body: JSON.stringify({ reaction: button.dataset.reaction })
        });
        updateCommentReactions(Number(button.dataset.commentReaction), data.reactions || [], state.article.comments);
        renderComments();
      } catch (error) {
        els.commentStatus.textContent = error.message;
        els.commentStatus.classList.add("is-error");
      }
    });
  });
}

function updateCommentReactions(commentId, reactions, list) {
  for (const comment of list) {
    if (comment.id === commentId) {
      comment.reactions = reactions;
      return true;
    }
    if (updateCommentReactions(commentId, reactions, comment.replies || [])) {
      return true;
    }
  }
  return false;
}

function renderComments() {
  const comments = state.article.comments || [];
  if (!comments.length) {
    els.comments.innerHTML = `<div class="empty-state"><strong>Пока нет комментариев</strong><p>Будьте первым, кто начнёт обсуждение.</p></div>`;
  } else {
    els.comments.innerHTML = comments.map(commentTemplate).join("");
    bindCommentInteractions();
  }

  if (state.me) {
    els.commentForm.classList.remove("hidden");
    els.loginLink.classList.add("hidden");
  } else {
    els.commentForm.classList.add("hidden");
    els.loginLink.classList.remove("hidden");
  }
}

async function loadArticle() {
  const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
  const [meData, articleData] = await Promise.all([
    optionalMe(),
    api(`/chat-api/knowledge/articles/${encodeURIComponent(slug)}`)
  ]);
  state.me = meData?.user || null;
  if (state.me) {
    els.composeLink.classList.remove("hidden");
  }
  state.article = articleData.article;
  renderArticle();
  await api(`/chat-api/knowledge/articles/${state.article.id}/view`, { method: "POST" }).catch(() => null);
}

els.commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api(`/chat-api/knowledge/articles/${state.article.id}/comments`, {
      method: "POST",
      body: JSON.stringify({
        content: els.commentContent.value,
        parentCommentId: els.parentCommentId.value || null
      })
    });
    state.article.comments = data.comments || [];
    els.commentContent.value = "";
    els.parentCommentId.value = "";
    els.cancelReplyButton.classList.add("hidden");
    els.commentStatus.textContent = "Комментарий добавлен.";
    els.commentStatus.classList.remove("is-error");
    renderComments();
  } catch (error) {
    els.commentStatus.textContent = error.message;
    els.commentStatus.classList.add("is-error");
  }
});

els.cancelReplyButton.addEventListener("click", () => {
  els.parentCommentId.value = "";
  els.cancelReplyButton.classList.add("hidden");
  els.commentStatus.textContent = "";
});

els.shareButton.addEventListener("click", async () => {
  try {
    if (navigator.share) {
      await navigator.share({ title: state.article?.title || document.title, url: location.href });
    } else {
      await navigator.clipboard.writeText(location.href);
      els.commentStatus.textContent = "Ссылка скопирована.";
      els.commentStatus.classList.remove("is-error");
    }
  } catch {
    // Ignore cancelled share.
  }
});

loadArticle().catch((error) => {
  els.title.textContent = "Не удалось открыть материал";
  els.body.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});
