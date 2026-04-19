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
    throw new Error(data.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ Р·Р°РїСЂРѕСЃ.");
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
    return "вЂ”";
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
      <article class="admin-table__row">
        <div>
          <strong>${adminEscapeHtml(user.displayName)}</strong>
          <span>@${adminEscapeHtml(user.username)}${user.isAdmin ? " В· admin" : ""}</span>
        </div>
        <div>
          <strong>${user.messageCount}</strong>
          <span>СЃРѕРѕР±С‰РµРЅРёР№</span>
        </div>
        <div>
          <strong>${adminFormatDate(user.lastLoginAt)}</strong>
          <span>РїРѕСЃР»РµРґРЅРёР№ РІС…РѕРґ</span>
        </div>
        <div>
          <strong>${adminFormatDate(user.createdAt)}</strong>
          <span>СЂРµРіРёСЃС‚СЂР°С†РёСЏ</span>
        </div>
      </article>
    `).join("")
    : `<div class="admin-empty">РџРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РїРѕРєР° РЅРµС‚.</div>`;
}

function renderAdminChannels() {
  const channels = adminState.overview?.channels || [];
  adminDom.channels.innerHTML = channels.length
    ? channels.map((channel) => `
      <article class="admin-mini-card">
        <div class="admin-message__header">
          <div>
            <strong>${adminEscapeHtml(channel.name)}</strong>
            <p>${adminEscapeHtml(channel.description || "Р‘РµР· РѕРїРёСЃР°РЅРёСЏ.")}</p>
          </div>
          <span class="admin-chip">${channel.kind === "personal" ? "Р›РёС‡РЅС‹Р№" : "РћР±С‰РёР№"}</span>
        </div>
        <div class="admin-message__footer admin-message__meta">
          <span>${adminEscapeHtml(channel.ownerDisplayName)}</span>
          <span>${channel.messageCount} СЃРѕРѕР±С‰РµРЅРёР№</span>
          <span>${channel.stats.onlineCount} online</span>
          <span>${channel.visitorCount} Р±С‹Р»Рё Р·РґРµСЃСЊ</span>
        </div>
      </article>
    `).join("")
    : `<div class="admin-empty">РљР°РЅР°Р»С‹ РїРѕРєР° РЅРµ СЃРѕР·РґР°РЅС‹.</div>`;
}

function renderAdminMessages() {
  const messages = adminState.overview?.recentMessages || [];
  adminDom.messagesTotalHint.textContent = `${messages.length} Р·Р°РїРёСЃРµР№`;

  adminDom.messages.innerHTML = messages.length
    ? messages.map((message) => {
      const isImage = message.attachmentType?.startsWith("image/");
      const attachment = message.hasAttachment ? `
        <div class="message-attachment">
          ${isImage ? `<img src="${message.attachmentUrl}" alt="??????????? ?? ????">` : ""}
          ${isImage ? "" : `<a href="${message.attachmentUrl}" target="_blank" rel="noopener noreferrer">${adminEscapeHtml(message.attachmentName || "????")}</a>`}
        </div>
      ` : "";

      return `
        <article class="admin-message" data-message-id="${message.id}">
          <div class="admin-message__header">
            <div>
              <strong>${adminEscapeHtml(message.displayName)}</strong>
              <div class="admin-message__meta">@${adminEscapeHtml(message.username)} В· ${adminEscapeHtml(message.channelName || "РљР°РЅР°Р»")}</div>
            </div>
            <button type="button" class="ghost-button ghost-button--small" data-delete-message="${message.id}">РЈРґР°Р»РёС‚СЊ</button>
          </div>
          <div class="admin-message__content">${adminEscapeHtml(message.content || "Р¤Р°Р№Р» Р±РµР· С‚РµРєСЃС‚Р°")}</div>
          ${attachment}
          <div class="admin-message__footer admin-message__meta">
            <span>${adminFormatDate(message.createdAt)}</span>
            <span>ID ${message.id}</span>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="admin-empty">РЎРѕРѕР±С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚.</div>`;

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
  if (!window.confirm("РЈРґР°Р»РёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ РёР· С‡Р°С‚Р° РєР°Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ?")) {
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
  document.body.innerHTML = `<main class="admin-page"><section class="panel admin-panel"><h1>РђРґРјРёРЅРєР° РЅРµРґРѕСЃС‚СѓРїРЅР°</h1><p class="admin-empty">${adminEscapeHtml(error.message)}</p></section></main>`;
});
