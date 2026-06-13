(() => {
  const root = document.getElementById("site-account");
  if (!root) {
    return;
  }

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const initialsFromName = (name) => {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) {
      return "U";
    }
    return parts.map((part) => part[0]).join("").toUpperCase();
  };

  const renderGuest = () => {
    root.innerHTML = `
      <div class="site-account__guest">
        <a class="account-link" href="/chat#login">Войти</a>
        <a class="account-link account-link--gold" href="/chat#register">Регистрация</a>
      </div>
    `;
  };

  const renderUser = (user) => {
    const avatar = user.avatarUrl
      ? `<img class="account-avatar" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.displayName || user.username)}">`
      : `<span class="account-avatar account-avatar--fallback">${escapeHtml(initialsFromName(user.displayName || user.username))}</span>`;

    root.innerHTML = `
      <div class="site-account__user">
        <a class="account-chip" href="/profile" aria-label="Открыть профиль">
          ${avatar}
          <span class="account-name">${escapeHtml(user.displayName || user.username)}</span>
        </a>
        <button class="account-button" type="button" id="site-account-logout">Выйти</button>
      </div>
    `;

    root.querySelector("#site-account-logout")?.addEventListener("click", async () => {
      try {
        const response = await fetch("/chat-api/auth/logout", {
          method: "POST",
          credentials: "same-origin"
        });
        if (!response.ok) {
          throw new Error("Не удалось выйти из профиля.");
        }
        if (window.location.pathname === "/profile" || window.location.pathname === "/profile.html") {
          window.location.href = "/";
          return;
        }
        renderGuest();
      } catch (error) {
        window.alert(error.message);
      }
    });
  };

  const bootstrap = async () => {
    try {
      const response = await fetch("/chat-api/me", {
        credentials: "same-origin"
      });
      if (response.status === 401) {
        renderGuest();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.user) {
        renderGuest();
        return;
      }
      renderUser(data.user);
    } catch {
      renderGuest();
    }
  };

  bootstrap();
})();
