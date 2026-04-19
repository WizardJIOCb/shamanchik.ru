const state = {
  me: null,
  channels: [],
  currentChannel: null,
  messages: [],
  members: [],
  socket: null,
  reconnectTimer: null
};

const dom = {
  authPanel: document.getElementById("auth-panel"),
  authStatus: document.getElementById("auth-status"),
  registerForm: document.getElementById("register-form"),
  loginForm: document.getElementById("login-form"),
  selfProfileCard: document.getElementById("self-profile-card"),
  selfDisplayName: document.getElementById("self-display-name"),
  selfUsername: document.getElementById("self-username"),
  logoutButton: document.getElementById("logout-button"),
  editProfileButton: document.getElementById("edit-profile-button"),
  adminLink: document.getElementById("admin-link"),
  channelPanel: document.getElementById("channel-panel"),
  channelSearch: document.getElementById("channel-search"),
  channelList: document.getElementById("channel-list"),
  createChannelButton: document.getElementById("create-channel-button"),
  channelTitle: document.getElementById("channel-title"),
  channelDescription: document.getElementById("channel-description"),
  statOnline: document.getElementById("stat-online"),
  statVisitors: document.getElementById("stat-visitors"),
  statDau: document.getElementById("stat-dau"),
  messagesList: document.getElementById("messages-list"),
  messageForm: document.getElementById("message-form"),
  messageContent: document.getElementById("message-content"),
  messageFile: document.getElementById("message-file"),
  fileName: document.getElementById("file-name"),
  emojiButton: document.getElementById("emoji-button"),
  emojiTray: document.getElementById("emoji-tray"),
  membersCount: document.getElementById("members-count"),
  membersList: document.getElementById("members-list"),
  channelEditor: document.getElementById("channel-editor"),
  channelEditForm: document.getElementById("channel-edit-form"),
  channelEditName: document.getElementById("channel-edit-name"),
  channelEditDescription: document.getElementById("channel-edit-description"),
  profileDialog: document.getElementById("profile-dialog"),
  profileDialogBody: document.getElementById("profile-dialog-body"),
  createChannelDialog: document.getElementById("create-channel-dialog"),
  createChannelForm: document.getElementById("create-channel-form"),
  editProfileDialog: document.getElementById("edit-profile-dialog"),
  editProfileForm: document.getElementById("edit-profile-form")
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса.");
  }
  return data;
}

function setStatus(message, isError = false) {
  dom.authStatus.textContent = message;
  dom.authStatus.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCount(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${value} ${one}`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${value} ${few}`;
  }
  return `${value} ${many}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
    .replace(/\n/g, "<br>");
}

function switchAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tab);
  });
  dom.registerForm.classList.toggle("is-hidden", tab !== "register");
  dom.loginForm.classList.toggle("is-hidden", tab !== "login");
}

function upsertMessage(message) {
  const index = state.messages.findIndex((item) => item.id === message.id);
  if (index >= 0) {
    state.messages[index] = message;
    return;
  }
  state.messages.push(message);
}

function removeMessage(messageId) {
  state.messages = state.messages.filter((message) => message.id !== messageId);
}

function syncChannelInList(channel) {
  state.channels = state.channels.map((item) => item.id === channel.id ? { ...item, ...channel } : item);
  renderChannels();
}

function renderSelf() {
  if (!state.me) {
    dom.selfProfileCard.classList.add("is-hidden");
    dom.authPanel.classList.remove("is-hidden");
    dom.channelPanel.classList.add("is-hidden");
    dom.adminLink?.classList.add("is-hidden");
    return;
  }

  dom.authPanel.classList.add("is-hidden");
  dom.selfProfileCard.classList.remove("is-hidden");
  dom.channelPanel.classList.remove("is-hidden");
  dom.selfDisplayName.textContent = state.me.displayName;
  dom.selfUsername.textContent = `@${state.me.username}`;
  dom.editProfileForm.displayName.value = state.me.displayName || "";
  dom.editProfileForm.bio.value = state.me.bio || "";
  dom.editProfileForm.location.value = state.me.location || "";

  if (dom.adminLink) {
    dom.adminLink.classList.toggle("is-hidden", !state.me.isAdmin);
  }
}

function renderChannels() {
  if (!state.channels.length) {
    dom.channelList.innerHTML = `<div class="empty-state"><p>Каналов пока нет. Создайте первый.</p></div>`;
    return;
  }

  dom.channelList.innerHTML = state.channels.map((channel) => `
    <article class="channel-card ${state.currentChannel?.id === channel.id ? "is-active" : ""}" data-channel-id="${channel.id}">
      <div class="channel-card__row">
        <strong>${escapeHtml(channel.name)}</strong>
        <span class="badge">${channel.kind === "personal" ? "Личный" : "Общий"}</span>
      </div>
      <p>${escapeHtml(channel.description || "Без описания.")}</p>
      <div class="channel-card__row channel-card__meta">
        <span>${escapeHtml(channel.ownerDisplayName)}</span>
        <span>${channel.stats.onlineCount} online</span>
      </div>
      <div class="channel-card__row channel-card__meta">
        <span>${channel.messageCount} сообщений</span>
        <span>${channel.stats.visitorCount} были здесь</span>
      </div>
    </article>
  `).join("");

  dom.channelList.querySelectorAll("[data-channel-id]").forEach((card) => {
    card.addEventListener("click", () => selectChannel(Number(card.dataset.channelId)));
  });
}

function renderChannelHeader(channel) {
  dom.channelTitle.textContent = channel?.name || "Выберите канал";
  dom.channelDescription.textContent = channel?.description || "После входа откроется список каналов, личная комната и поиск по общему каталогу обсуждений.";
  dom.statOnline.textContent = channel?.stats?.onlineCount ?? 0;
  dom.statVisitors.textContent = channel?.stats?.visitorCount ?? 0;
  dom.statDau.textContent = channel ? `${channel.stats.dau} / ${channel.stats.wau} / ${channel.stats.mau}` : "0 / 0 / 0";
}

function renderMessages() {
  if (!state.currentChannel) {
    dom.messagesList.innerHTML = `<div class="empty-state"><h2>Чат ждёт подключения</h2><p>Выберите канал, чтобы увидеть сообщения, онлайн-пользователей и статистику.</p></div>`;
    dom.messageForm.classList.add("is-hidden");
    return;
  }

  dom.messageForm.classList.remove("is-hidden");

  if (!state.messages.length) {
    dom.messagesList.innerHTML = `<div class="empty-state"><h2>Пока тихо</h2><p>Начните разговор, прикрепите файл или откройте личный канал для своих тем.</p></div>`;
    return;
  }

  dom.messagesList.innerHTML = state.messages.map((message) => {
    const attachment = message.hasAttachment ? `
      <div class="message-attachment">
        ${message.attachmentType?.startsWith("image/") ? `<img src="${message.attachmentUrl}" alt="${escapeHtml(message.attachmentName || "attachment")}">` : ""}
        <a href="${message.attachmentUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(message.attachmentName || "Скачать файл")}</a>
      </div>
    ` : "";

    const actions = message.canDelete ? `
      <button type="button" class="ghost-button ghost-button--small message-delete-button" data-message-id="${message.id}">
        Удалить
      </button>
    ` : "";

    return `
      <article class="message-card">
        <div class="message-card__meta">
          <strong class="message-card__author">${escapeHtml(message.displayName)}</strong>
          <div class="message-card__actions">
            <span>${formatDate(message.createdAt)}</span>
            ${actions}
          </div>
        </div>
        <div class="message-card__body">${escapeHtml(message.content || "")}</div>
        ${attachment}
      </article>
    `;
  }).join("");

  dom.messagesList.querySelectorAll("[data-message-id]").forEach((button) => {
    button.addEventListener("click", () => handleDeleteMessage(Number(button.dataset.messageId)));
  });

  dom.messagesList.scrollTop = dom.messagesList.scrollHeight;
}

function renderMembers() {
  dom.membersCount.textContent = state.members.length
    ? formatCount(state.members.length, "участник", "участника", "участников")
    : "0 участников";

  if (!state.members.length) {
    dom.membersList.innerHTML = `<div class="empty-state"><p>Список участников появится после открытия канала.</p></div>`;
    return;
  }

  dom.membersList.innerHTML = state.members.map((member) => `
    <article class="member-card ${member.isOnline ? "is-online" : ""}" data-user-id="${member.id}">
      <div class="member-card__row">
        <strong>${escapeHtml(member.displayName)}</strong>
        <span class="member-status">${member.isOnline ? "в сети" : "не в сети"}</span>
      </div>
      <p class="member-card__meta">@${escapeHtml(member.username)}${member.isAdmin ? " · admin" : ""}</p>
      <div class="member-card__row member-card__meta">
        <span>${member.messageCount} сообщений</span>
        <span>${member.createdChannelsCount} каналов</span>
      </div>
    </article>
  `).join("");

  dom.membersList.querySelectorAll("[data-user-id]").forEach((card) => {
    card.addEventListener("click", () => openProfile(Number(card.dataset.userId)));
  });
}

function renderChannelEditor() {
  if (!state.currentChannel || !state.me || (state.currentChannel.ownerUserId !== state.me.id && !state.me.isAdmin)) {
    dom.channelEditor.classList.add("is-hidden");
    return;
  }
  dom.channelEditor.classList.remove("is-hidden");
  dom.channelEditName.value = state.currentChannel.name || "";
  dom.channelEditDescription.value = state.currentChannel.description || "";
}

function connectSocket() {
  if (state.socket) {
    state.socket.close();
  }
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  state.socket = new WebSocket(`${protocol}//${location.host}/chat-ws`);

  state.socket.addEventListener("open", () => {
    if (state.currentChannel) {
      state.socket.send(JSON.stringify({ type: "subscribe", channelId: state.currentChannel.id }));
    }
  });

  state.socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "messageCreated" && payload.message.channelId === state.currentChannel?.id) {
      upsertMessage(payload.message);
      if (payload.channel) {
        state.currentChannel = payload.channel;
        syncChannelInList(payload.channel);
        renderChannelHeader(state.currentChannel);
      }
      renderMessages();
      return;
    }

    if (payload.type === "messageDeleted" && state.currentChannel?.id === payload.channel?.id) {
      removeMessage(payload.messageId);
      if (payload.channel) {
        state.currentChannel = payload.channel;
        syncChannelInList(payload.channel);
        renderChannelHeader(state.currentChannel);
      }
      renderMessages();
      return;
    }

    if (payload.type === "presence" && state.currentChannel) {
      state.currentChannel.stats = payload.stats;
      state.members = payload.users.map((user) => {
        const existing = state.members.find((member) => member.id === user.id);
        return existing ? { ...existing, ...user, isOnline: true } : { ...user, isOnline: true };
      }).concat(
        state.members
          .filter((member) => !payload.users.some((user) => user.id === member.id))
          .map((member) => ({ ...member, isOnline: false }))
      );
      renderChannelHeader(state.currentChannel);
      renderMembers();
      syncChannelInList(state.currentChannel);
      return;
    }

    if (payload.type === "channelUpdated" && state.currentChannel?.id === payload.channel.id) {
      state.currentChannel = payload.channel;
      renderChannelHeader(state.currentChannel);
      renderChannelEditor();
      syncChannelInList(payload.channel);
    }
  });

  state.socket.addEventListener("close", () => {
    if (!state.me) {
      return;
    }
    state.reconnectTimer = setTimeout(connectSocket, 1500);
  });
}

async function bootstrap() {
  try {
    const data = await api("/chat-api/me");
    state.me = data.user;
    state.channels = data.channels;
    renderSelf();
    renderChannels();
    connectSocket();

    const preferred = state.channels.find((channel) => channel.kind === "personal" && channel.ownerUserId === state.me.id) || state.channels[0];
    if (preferred) {
      await selectChannel(preferred.id);
    }
  } catch {
    state.me = null;
    state.channels = [];
    renderSelf();
    renderChannels();
  }
}

async function selectChannel(channelId) {
  const [channelData, messagesData] = await Promise.all([
    api(`/chat-api/channels/${channelId}`),
    api(`/chat-api/channels/${channelId}/messages`)
  ]);

  state.currentChannel = channelData.channel;
  state.members = channelData.users;
  state.messages = messagesData.messages;

  renderChannels();
  renderChannelHeader(state.currentChannel);
  renderMessages();
  renderMembers();
  renderChannelEditor();

  if (state.socket?.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: "subscribe", channelId }));
  }
}

async function openProfile(userId) {
  const { user } = await api(`/chat-api/users/${userId}`);
  dom.profileDialogBody.innerHTML = `
    <section class="profile-summary">
      <h3>${escapeHtml(user.displayName)}</h3>
      <p>@${escapeHtml(user.username)}${user.isAdmin ? " · администратор" : ""}</p>
      <p>${escapeHtml(user.bio || "Пользователь пока ничего не рассказал о себе.")}</p>
      <p>${user.location ? `Локация: ${escapeHtml(user.location)}` : "Локация не указана."}</p>
    </section>
    <section class="profile-stats">
      <article class="profile-stat"><span>Дата регистрации</span><strong>${formatDate(user.createdAt)}</strong></article>
      <article class="profile-stat"><span>Последний вход</span><strong>${formatDate(user.lastLoginAt)}</strong></article>
      <article class="profile-stat"><span>Последняя активность</span><strong>${formatDate(user.lastSeenAt)}</strong></article>
      <article class="profile-stat"><span>Сообщений</span><strong>${user.messageCount}</strong></article>
      <article class="profile-stat"><span>Создано каналов</span><strong>${user.createdChannelsCount}</strong></article>
      <article class="profile-stat"><span>Состоит в чатах</span><strong>${user.joinedChannelsCount}</strong></article>
    </section>
  `;
  dom.profileDialog.showModal();
}

async function handleDeleteMessage(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) {
    return;
  }
  const confirmText = state.me?.isAdmin && message.userId !== state.me.id
    ? "Удалить чужое сообщение как администратор?"
    : "Удалить сообщение?";
  if (!window.confirm(confirmText)) {
    return;
  }

  const response = await api(`/chat-api/messages/${messageId}`, {
    method: "DELETE"
  });
  removeMessage(messageId);
  if (response.channel) {
    state.currentChannel = response.channel;
    syncChannelInList(response.channel);
    renderChannelHeader(state.currentChannel);
  }
  renderMessages();
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
});

dom.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(dom.registerForm);
  try {
    const data = await api("/chat-api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    state.me = data.user;
    state.channels = data.channels;
    setStatus("Аккаунт создан. Открываю ваш чат.");
    renderSelf();
    renderChannels();
    connectSocket();
    const personal = state.channels.find((channel) => channel.kind === "personal" && channel.ownerUserId === state.me.id) || state.channels[0];
    if (personal) {
      await selectChannel(personal.id);
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

dom.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(dom.loginForm);
  try {
    const data = await api("/chat-api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    state.me = data.user;
    state.channels = data.channels;
    setStatus("Вход выполнен.");
    renderSelf();
    renderChannels();
    connectSocket();
    if (state.channels[0]) {
      await selectChannel(state.channels[0].id);
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

dom.logoutButton.addEventListener("click", async () => {
  await api("/chat-api/auth/logout", { method: "POST" });
  state.me = null;
  state.channels = [];
  state.currentChannel = null;
  state.members = [];
  state.messages = [];
  state.socket?.close();
  renderSelf();
  renderChannels();
  renderChannelHeader(null);
  renderMessages();
  renderMembers();
  setStatus("Вы вышли из чата.");
});

dom.channelSearch.addEventListener("input", async () => {
  if (!state.me) {
    return;
  }
  const data = await api(`/chat-api/channels?q=${encodeURIComponent(dom.channelSearch.value)}`);
  state.channels = data.channels;
  renderChannels();
});

dom.messageFile.addEventListener("change", () => {
  dom.fileName.textContent = dom.messageFile.files[0]?.name || "Файл не выбран";
});

dom.emojiButton.addEventListener("click", () => {
  dom.emojiTray.classList.toggle("is-hidden");
});

dom.emojiTray.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    dom.messageContent.value += button.textContent;
    dom.messageContent.focus();
  });
});

dom.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.currentChannel) {
    return;
  }

  const formData = new FormData();
  formData.set("content", dom.messageContent.value);
  if (dom.messageFile.files[0]) {
    formData.set("file", dom.messageFile.files[0]);
  }

  try {
    const response = await api(`/chat-api/channels/${state.currentChannel.id}/messages`, {
      method: "POST",
      body: formData
    });
    upsertMessage(response.message);
    if (response.channel) {
      state.currentChannel = response.channel;
      syncChannelInList(response.channel);
      renderChannelHeader(state.currentChannel);
    }
    renderMessages();
    dom.messageContent.value = "";
    dom.messageFile.value = "";
    dom.fileName.textContent = "Файл не выбран";
    dom.emojiTray.classList.add("is-hidden");
  } catch (error) {
    alert(error.message);
  }
});

dom.createChannelButton.addEventListener("click", () => {
  dom.createChannelDialog.showModal();
});

dom.createChannelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(dom.createChannelForm);
  try {
    const data = await api("/chat-api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    state.channels = data.channels;
    renderChannels();
    dom.createChannelDialog.close();
    dom.createChannelForm.reset();
    await selectChannel(data.channel.id);
  } catch (error) {
    alert(error.message);
  }
});

dom.channelEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.currentChannel) {
    return;
  }
  try {
    const data = await api(`/chat-api/channels/${state.currentChannel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: dom.channelEditName.value,
        description: dom.channelEditDescription.value
      })
    });
    state.currentChannel = data.channel;
    state.channels = data.channels;
    renderChannels();
    renderChannelHeader(state.currentChannel);
    renderChannelEditor();
  } catch (error) {
    alert(error.message);
  }
});

dom.editProfileButton.addEventListener("click", () => {
  dom.editProfileDialog.showModal();
});

dom.editProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(dom.editProfileForm);
  try {
    const data = await api("/chat-api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    state.me = data.user;
    state.channels = data.channels;
    renderSelf();
    renderChannels();
    dom.editProfileDialog.close();
  } catch (error) {
    alert(error.message);
  }
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog").close();
  });
});

bootstrap();
