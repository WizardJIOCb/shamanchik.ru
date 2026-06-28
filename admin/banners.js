const state = {
  banners: [],
  selectedId: null
};

const els = {
  list: document.querySelector("#banner-list"),
  count: document.querySelector("#banner-count"),
  form: document.querySelector("#banner-form"),
  title: document.querySelector("#editor-title"),
  preview: document.querySelector("#banner-preview"),
  status: document.querySelector("#status"),
  newButton: document.querySelector("#new-banner"),
  saveButton: document.querySelector("#save-banner"),
  deleteButton: document.querySelector("#delete-banner")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\)/g, "%29");
}

function showStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
  els.status.classList.add("is-visible");
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => {
    els.status.classList.remove("is-visible");
  }, 3200);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options
  });

  if (response.status === 401) {
    window.location.href = "/chat";
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса.");
  }
  return data;
}

function emptyBanner() {
  return {
    id: "",
    title: "",
    category: "",
    imageUrl: "",
    altText: "",
    sortOrder: state.banners.length,
    isActive: true
  };
}

function renderList() {
  els.count.textContent = `${state.banners.length} баннеров`;
  if (!state.banners.length) {
    els.list.innerHTML = '<p class="record-empty">Баннеров пока нет.</p>';
    return;
  }
  els.list.innerHTML = state.banners.map((banner) => `
    <button class="product-list__item${banner.id === state.selectedId ? " is-selected" : ""}" type="button" data-id="${banner.id}">
      <span class="product-list__image product-list__image--wide" style="--image: url('${escapeAttr(banner.imageUrl || "/images/banner2.jpg")}')"></span>
      <span>
        <strong>${escapeHtml(banner.title || banner.category || "Без названия")}</strong>
        <span>${escapeHtml(banner.category || "Без категории")}</span>
        <span>${banner.isActive ? "Показывается" : "Скрыт"} · ${escapeHtml(banner.imageUrl || "без изображения")}</span>
      </span>
    </button>
  `).join("");
}

function selectedBanner() {
  return state.banners.find((banner) => banner.id === state.selectedId) || null;
}

function setPreview(imageUrl) {
  els.preview.style.setProperty("--image", imageUrl ? `url('${imageUrl}')` : "none");
}

function fillForm(banner) {
  const record = banner || emptyBanner();
  els.form.elements.id.value = record.id || "";
  els.form.elements.title.value = record.title || "";
  els.form.elements.category.value = record.category || "";
  els.form.elements.altText.value = record.altText || "";
  els.form.elements.sortOrder.value = record.sortOrder ?? 0;
  els.form.elements.imageUrl.value = record.imageUrl || "";
  els.form.elements.imageFile.value = "";
  els.form.elements.isActive.checked = Boolean(record.isActive);
  setPreview(record.imageUrl || "");
  els.title.textContent = record.id ? (record.title || record.category) : "Новый баннер";
  els.deleteButton.disabled = !record.id;
}

function selectBanner(bannerId) {
  state.selectedId = bannerId || null;
  fillForm(selectedBanner());
  renderList();
}

function payloadFromForm() {
  const form = els.form.elements;
  return {
    title: form.title.value,
    category: form.category.value,
    altText: form.altText.value,
    sortOrder: Number(form.sortOrder.value || 0),
    imageUrl: form.imageUrl.value,
    isActive: form.isActive.checked
  };
}

async function loadBanners(selectedId = state.selectedId) {
  const data = await fetchJson("/chat-api/admin/banners");
  if (!data) return;
  state.banners = data.banners || [];
  const nextId = selectedId && state.banners.some((banner) => banner.id === selectedId)
    ? selectedId
    : state.banners[0]?.id || null;
  selectBanner(nextId);
}

async function saveBanner() {
  const id = Number(els.form.elements.id.value || 0);
  const url = id ? `/chat-api/admin/banners/${id}` : "/chat-api/admin/banners";
  const method = id ? "PATCH" : "POST";
  const data = await fetchJson(url, {
    method,
    body: JSON.stringify(payloadFromForm())
  });
  if (!data) return;

  const file = els.form.elements.imageFile.files[0];
  let banner = data.banner;
  if (file) {
    const body = new FormData();
    body.append("image", file);
    const imageData = await fetchJson(`/chat-api/admin/banners/${banner.id}/image`, {
      method: "POST",
      body
    });
    banner = imageData.banner;
  }

  await loadBanners(banner.id);
  showStatus(id ? "Баннер сохранён." : "Баннер создан.");
}

async function deleteBanner() {
  const record = selectedBanner();
  if (!record) return;
  if (!window.confirm(`Удалить баннер «${record.title || record.category || "без названия"}»?`)) return;
  await fetchJson(`/chat-api/admin/banners/${record.id}`, { method: "DELETE" });
  state.selectedId = null;
  await loadBanners();
  showStatus("Баннер удалён.");
}

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  selectBanner(Number(button.dataset.id));
});

els.newButton.addEventListener("click", () => {
  state.selectedId = null;
  fillForm(emptyBanner());
  renderList();
});

els.saveButton.addEventListener("click", async () => {
  try {
    els.saveButton.disabled = true;
    await saveBanner();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.saveButton.disabled = false;
  }
});

els.deleteButton.addEventListener("click", async () => {
  try {
    els.deleteButton.disabled = true;
    await deleteBanner();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.deleteButton.disabled = false;
  }
});

els.form.elements.imageUrl.addEventListener("input", () => {
  setPreview(els.form.elements.imageUrl.value.trim());
});

els.form.elements.imageFile.addEventListener("change", () => {
  const file = els.form.elements.imageFile.files[0];
  if (!file) return;
  setPreview(URL.createObjectURL(file));
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
});

loadBanners().catch((error) => {
  showStatus(error.message, true);
  fillForm(emptyBanner());
});
