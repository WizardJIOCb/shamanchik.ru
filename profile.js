(() => {
  const dom = {
    avatarSlot: document.getElementById("profile-avatar-slot"),
    displayName: document.getElementById("profile-display-name"),
    username: document.getElementById("profile-username"),
    bio: document.getElementById("profile-bio"),
    location: document.getElementById("profile-location"),
    ordersCount: document.getElementById("profile-orders-count"),
    createdAt: document.getElementById("profile-created-at"),
    profileForm: document.getElementById("profile-form"),
    avatarForm: document.getElementById("avatar-form"),
    avatarInput: document.getElementById("avatar-input"),
    avatarFileName: document.getElementById("avatar-file-name"),
    displayNameInput: document.getElementById("display-name-input"),
    usernameInput: document.getElementById("username-input"),
    locationInput: document.getElementById("location-input"),
    bioInput: document.getElementById("bio-input"),
    profileStatus: document.getElementById("profile-status"),
    ordersList: document.getElementById("orders-list")
  };

  const state = {
    me: null,
    orders: []
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function initialsFromName(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) {
      return "U";
    }
    return parts.map((part) => part[0]).join("").toUpperCase();
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.href = "/chat#login";
      throw new Error("Требуется авторизация.");
    }
    if (!response.ok) {
      throw new Error(data.error || "Не удалось выполнить запрос.");
    }
    return data;
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

  function formatPrice(value) {
    return new Intl.NumberFormat("ru-RU").format(Number(value || 0)) + " ₽";
  }

  function statusLabel(status) {
    const map = {
      new: "Новый",
      created: "Создан",
      payment_pending: "Ожидает оплату",
      paid: "Оплачен",
      completed: "Завершен",
      canceled: "Отменен",
      payment_canceled: "Оплата отменена"
    };
    return map[status] || status || "Без статуса";
  }

  function setStatus(message = "", type = "") {
    dom.profileStatus.textContent = message;
    dom.profileStatus.classList.toggle("is-error", type === "error");
    dom.profileStatus.classList.toggle("is-success", type === "success");
  }

  function renderAvatar(user) {
    if (user.avatarUrl) {
      dom.avatarSlot.innerHTML = `<img class="profile-card__avatar" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.displayName || user.username)}">`;
      return;
    }
    dom.avatarSlot.innerHTML = `<div class="avatar-fallback">${escapeHtml(initialsFromName(user.displayName || user.username))}</div>`;
  }

  function renderProfile() {
    const user = state.me;
    if (!user) {
      return;
    }

    renderAvatar(user);
    dom.displayName.textContent = user.displayName || user.username;
    dom.username.textContent = `@${user.username}`;
    dom.bio.textContent = user.bio || "Пока без описания. Этот блок можно заполнить в настройках справа.";
    dom.location.textContent = user.location || "Не указано";
    dom.ordersCount.textContent = String(state.orders.length);
    dom.createdAt.textContent = formatDate(user.createdAt);
    dom.displayNameInput.value = user.displayName || "";
    dom.usernameInput.value = `@${user.username}`;
    dom.locationInput.value = user.location || "";
    dom.bioInput.value = user.bio || "";
  }

  function renderOrders() {
    if (!state.orders.length) {
      dom.ordersList.innerHTML = `
        <div class="empty-state">
          <h3>Заказов пока нет</h3>
          <p>Когда вы оформите заказ на сайте, он появится здесь автоматически.</p>
        </div>
      `;
      return;
    }

    dom.ordersList.innerHTML = state.orders.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsMarkup = items.map((item) => `
        <li>
          <span>${escapeHtml(item.title || item.name || "Товар")}${item.unit ? `, ${escapeHtml(item.unit)}` : ""}</span>
          <strong>${escapeHtml(String(item.quantity || 1))} × ${formatPrice(item.price || 0)}</strong>
        </li>
      `).join("");

      return `
        <article class="order-card">
          <div class="order-card__top">
            <div>
              <h3>Заказ ${escapeHtml(order.publicId)}</h3>
              <div class="order-card__meta">${formatDate(order.createdAt)}</div>
            </div>
            <span class="order-card__status">${escapeHtml(statusLabel(order.status))}</span>
          </div>
          <ul class="order-card__items">${itemsMarkup}</ul>
          <div class="order-card__summary">
            <span>Итого</span>
            <strong>${formatPrice(order.total)}</strong>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadProfile() {
    const [meData, ordersData] = await Promise.all([
      api("/chat-api/me"),
      api("/chat-api/me/orders")
    ]);

    state.me = meData.user;
    state.orders = ordersData.orders || [];
    renderProfile();
    renderOrders();
  }

  dom.profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Сохраняю изменения...");
    try {
      const payload = {
        displayName: dom.displayNameInput.value,
        location: dom.locationInput.value,
        bio: dom.bioInput.value
      };
      const data = await api("/chat-api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      state.me = data.user;
      renderProfile();
      setStatus("Профиль сохранен.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  dom.avatarInput?.addEventListener("change", async () => {
    const file = dom.avatarInput.files?.[0];
    dom.avatarFileName.textContent = file?.name || "Файл не выбран";
    if (!file) {
      return;
    }

    setStatus("Загружаю аватар...");
    try {
      const formData = new FormData(dom.avatarForm);
      const data = await api("/chat-api/me/avatar", {
        method: "POST",
        body: formData
      });
      state.me = data.user;
      renderProfile();
      setStatus("Аватар обновлен.", "success");
      dom.avatarInput.value = "";
      dom.avatarFileName.textContent = "Файл не выбран";
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  loadProfile().catch((error) => {
    setStatus(error.message, "error");
    dom.ordersList.innerHTML = `
      <div class="empty-state">
        <h3>Не удалось загрузить профиль</h3>
        <p>Попробуйте обновить страницу или войти заново.</p>
      </div>
    `;
  });
})();
