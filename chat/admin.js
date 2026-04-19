const adminDom = {
  refreshButton: document.getElementById("refresh-admin-button"),
  statUsers: document.getElementById("stat-users"),
  statChannels: document.getElementById("stat-channels"),
  statMessages: document.getElementById("stat-messages"),
  statAttachments: document.getElementById("stat-attachments"),
  messagesTotalHint: document.getElementById("messages-total-hint"),
  users: document.getElementById("admin-users"),
  channels: document.getElementById("admin-channels"),
  messages: document.getElementById("admin-messages")
};

const adminState = {
  overview: null
};

async function adminApi(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Не удалось выполнить запрос.");
  }
  return data;
}

function adminEscapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
    .replace(/\n/g, "<br>");
}

function adminFormatDate(value) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderAdminStats() {
  const stats = adminState.overview?.stats;
  if (!stats) {
    return;
  }

  adminDom.statUsers.textContent = String(stats.userCount);
  adminDom.statChannels.textContent = String(stats.channelCount);
  adminDom.statMessages.textContent = String(stats.messageCount);
  adminDom.statAttachments.textContent = String(stats.attachmentCount);
}

function renderAdminUsers() {
  const users = adminState.overview?.users || [];
  adminDom.users.innerHTML = users.length
    ? users.map((user) => `
      <article class="admin-user-card">
        <div class="admin-user-card__main">
          <strong>${adminEscapeHtml(user.displayName)}</strong>
          <span>@${adminEscapeHtml(user.username)}${user.isAdmin ? " · admin" : ""} · ${user.messageCount} сообщений</span>
        </div>
        <div class="admin-user-card__stats">
          <div class="admin-user-card__stat">
            <strong>${adminFormatDate(user.lastLoginAt)}</strong>
            <span>Последний вход</span>
          </div>
          <div class="admin-user-card__stat">
            <strong>${adminFormatDate(user.createdAt)}</strong>
            <span>Регистрация</span>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="admin-empty">Пользователей пока нет.</div>`;
}

function renderAdminChannels() {
  const channels = adminState.overview?.channels || [];
  adminDom.channels.innerHTML = channels.length
    ? channels.map((channel) => `
      <article class="admin-mini-card">
        <div class="admin-message__header">
          <div>
            <strong>${adminEscapeHtml(channel.name)}</strong>
            <p>${adminEscapeHtml(channel.description || "Без описания.")}</p>
          </div>
          <span class="admin-chip">${channel.kind === "personal" ? "Личный" : "Общий"}</span>
        </div>
        <div class="admin-message__footer admin-message__meta">
          <span>${adminEscapeHtml(channel.ownerDisplayName)}</span>
          <span>${channel.messageCount} сообщений</span>
          <span>${channel.stats.onlineCount} online</span>
          <span>${channel.visitorCount} были здесь</span>
        </div>
      </article>
    `).join("")
    : `<div class="admin-empty">Каналы пока не созданы.</div>`;
}

function renderAdminMessages() {
  const messages = adminState.overview?.recentMessages || [];
  adminDom.messagesTotalHint.textContent = `${messages.length} записей`;

  adminDom.messages.innerHTML = messages.length
    ? messages.map((message) => {
      const isImage = message.attachmentType?.startsWith("image/");
      const attachment = message.hasAttachment ? `
        <div class="message-attachment">
          ${isImage ? `<img src="${message.attachmentUrl}" alt="Изображение из чата">` : ""}
          ${isImage ? "" : `<a href="${message.attachmentUrl}" target="_blank" rel="noopener noreferrer">${adminEscapeHtml(message.attachmentName || "Файл")}</a>`}
        </div>
      ` : "";

      return `
        <article class="admin-message" data-message-id="${message.id}">
          <div class="admin-message__header">
            <div>
              <strong>${adminEscapeHtml(message.displayName)}</strong>
              <div class="admin-message__meta">@${adminEscapeHtml(message.username)} · ${adminEscapeHtml(message.channelName || "Канал")}</div>
            </div>
            <button type="button" class="ghost-button ghost-button--small" data-delete-message="${message.id}">Удалить</button>
          </div>
          <div class="admin-message__content">${adminEscapeHtml(message.content || "Файл без текста")}</div>
          ${attachment}
          <div class="admin-message__footer admin-message__meta">
            <span>${adminFormatDate(message.createdAt)}</span>
            <span>ID ${message.id}</span>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="admin-empty">Сообщений пока нет.</div>`;

  adminDom.messages.querySelectorAll("[data-delete-message]").forEach((button) => {
    button.addEventListener("click", () => handleAdminDeleteMessage(Number(button.dataset.deleteMessage)));
  });
}

async function loadAdminOverview() {
  const overview = await adminApi("/chat-api/admin/overview");
  adminState.overview = overview;
  renderAdminStats();
  renderAdminUsers();
  renderAdminChannels();
  renderAdminMessages();
}

async function handleAdminDeleteMessage(messageId) {
  if (!window.confirm("Удалить сообщение из чата как администратор?")) {
    return;
  }

  await adminApi(`/chat-api/messages/${messageId}`, {
    method: "DELETE"
  });

  if (adminState.overview) {
    adminState.overview.recentMessages = adminState.overview.recentMessages.filter((message) => message.id !== messageId);
    if (adminState.overview.stats.messageCount > 0) {
      adminState.overview.stats.messageCount -= 1;
    }
  }

  renderAdminStats();
  renderAdminMessages();
  await loadAdminOverview();
}

adminDom.refreshButton.addEventListener("click", () => {
  loadAdminOverview().catch((error) => {
    window.alert(error.message);
  });
});

loadAdminOverview().catch((error) => {
  document.body.innerHTML = `<main class="admin-page"><section class="panel admin-panel"><h1>Админка недоступна</h1><p class="admin-empty">${adminEscapeHtml(error.message)}</p></section></main>`;
});
