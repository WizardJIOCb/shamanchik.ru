const state = {
  promoCodes: [],
  selectedId: null
};

const els = {
  list: document.querySelector("#promocode-list"),
  count: document.querySelector("#promocode-count"),
  summary: document.querySelector("#promocodes-summary"),
  summaryStatus: document.querySelector("#promocodes-summary-status"),
  form: document.querySelector("#promocode-form"),
  title: document.querySelector("#editor-title"),
  usageCount: document.querySelector("#promocode-usage-count"),
  remainingUses: document.querySelector("#promocode-remaining-uses"),
  newButton: document.querySelector("#new-promocode"),
  saveButton: document.querySelector("#save-promocode"),
  deleteButton: document.querySelector("#delete-promocode"),
  refreshButton: document.querySelector("#refresh-promocodes"),
  status: document.querySelector("#status")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizedCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function promoLabel(record) {
  return record.discountKind === "fixed"
    ? `${Number(record.discountValue || 0).toLocaleString("ru-RU")} ₽`
    : `${Number(record.discountValue || 0)}%`;
}

function promoStateLabel(record) {
  if (!record.isActive) return "Отключён";
  if (record.endsAt && new Date(record.endsAt).getTime() < Date.now()) return "Истёк";
  if (record.startsAt && new Date(record.startsAt).getTime() > Date.now()) return "Запланирован";
  if (record.maxUses > 0 && Number(record.remainingUses || 0) <= 0) return "Лимит исчерпан";
  return "Активен";
}

function selectedRecord() {
  return state.promoCodes.find((record) => record.id === state.selectedId) || null;
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
    headers: options.body ? { "Content-Type": "application/json" } : {},
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

function renderSummary() {
  const total = state.promoCodes.length;
  const active = state.promoCodes.filter((record) => promoStateLabel(record) === "Активен").length;
  const limited = state.promoCodes.filter((record) => Number(record.maxUses || 0) > 0).length;
  const expired = state.promoCodes.filter((record) => {
    const status = promoStateLabel(record);
    return status === "Истёк" || status === "Отключён";
  }).length;
  const cards = [
    ["Всего", total],
    ["Активных", active],
    ["С лимитом", limited],
    ["Истекли / отключены", expired]
  ];
  els.summary.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `).join("");
}

function renderList() {
  els.count.textContent = `${state.promoCodes.length} промокодов`;
  if (!state.promoCodes.length) {
    els.list.innerHTML = '<p class="record-empty">Промокодов пока нет.</p>';
    return;
  }
  els.list.innerHTML = state.promoCodes.map((record) => `
    <button class="record-list__item${record.id === state.selectedId ? " is-selected" : ""}" type="button" data-id="${record.id}">
      <span class="record-list__row">
        <strong>${escapeHtml(record.code)}</strong>
        <span class="status-pill ${promoStateLabel(record) === "Активен" ? "is-success" : ""}">${escapeHtml(promoStateLabel(record))}</span>
      </span>
      <span>${escapeHtml(promoLabel(record))}</span>
      <span>${escapeHtml(record.description || "Без описания")}</span>
      <span>${escapeHtml(record.maxUses > 0 ? `Использовано ${record.usageCount} из ${record.maxUses}` : `Использовано ${record.usageCount}`)}</span>
    </button>
  `).join("");
}

function fillForm(record) {
  els.form.elements.id.value = record?.id || "";
  els.form.elements.code.value = record?.code || "";
  els.form.elements.description.value = record?.description || "";
  els.form.elements.discountKind.value = record?.discountKind || "percent";
  els.form.elements.discountValue.value = record?.discountValue ?? "";
  els.form.elements.maxUses.value = record?.maxUses ?? 0;
  els.form.elements.startsAt.value = toLocalInputValue(record?.startsAt);
  els.form.elements.endsAt.value = toLocalInputValue(record?.endsAt);
  els.form.elements.isActive.value = String(record ? Boolean(record.isActive) : true);
  els.title.textContent = record ? `Промокод ${record.code}` : "Новый промокод";
  els.usageCount.textContent = record ? String(record.usageCount || 0) : "—";
  els.remainingUses.textContent = record ? (record.remainingUses === null ? "Без лимита" : String(record.remainingUses)) : "—";
  els.deleteButton.disabled = !record;
}

async function loadPromoCodes() {
  const data = await fetchJson("/chat-api/admin/promocodes");
  if (!data) return;
  state.promoCodes = data.promoCodes || [];
  renderSummary();
  renderList();
  els.summaryStatus.textContent = "Промокоды обновлены";
  if (!state.promoCodes.some((record) => record.id === state.selectedId)) {
    state.selectedId = state.promoCodes[0]?.id || null;
  }
  fillForm(selectedRecord());
  renderList();
}

function payloadFromForm() {
  return {
    code: normalizedCode(els.form.elements.code.value),
    description: String(els.form.elements.description.value || "").trim(),
    discountKind: els.form.elements.discountKind.value,
    discountValue: Number(els.form.elements.discountValue.value || 0),
    maxUses: Number(els.form.elements.maxUses.value || 0),
    startsAt: els.form.elements.startsAt.value || "",
    endsAt: els.form.elements.endsAt.value || "",
    isActive: els.form.elements.isActive.value === "true"
  };
}

async function savePromoCode() {
  const id = Number(els.form.elements.id.value || 0);
  const url = id ? `/chat-api/admin/promocodes/${id}` : "/chat-api/admin/promocodes";
  const method = id ? "PATCH" : "POST";
  const data = await fetchJson(url, { method, body: JSON.stringify(payloadFromForm()) });
  await loadPromoCodes();
  state.selectedId = data?.promoCode?.id || state.selectedId;
  fillForm(selectedRecord());
  renderList();
  showStatus(id ? "Промокод сохранён." : "Промокод создан.");
}

async function deletePromoCode() {
  const record = selectedRecord();
  if (!record) return;
  if (!window.confirm(`Удалить промокод ${record.code}?`)) return;
  await fetchJson(`/chat-api/admin/promocodes/${record.id}`, { method: "DELETE" });
  state.selectedId = null;
  await loadPromoCodes();
  showStatus("Промокод удалён.");
}

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  state.selectedId = Number(button.dataset.id);
  renderList();
  fillForm(selectedRecord());
});

els.newButton.addEventListener("click", () => {
  state.selectedId = null;
  renderList();
  fillForm(null);
  els.form.elements.maxUses.value = 0;
  els.form.elements.isActive.value = "true";
});

els.saveButton.addEventListener("click", async () => {
  try {
    els.saveButton.disabled = true;
    await savePromoCode();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.saveButton.disabled = false;
  }
});

els.deleteButton.addEventListener("click", async () => {
  try {
    els.deleteButton.disabled = true;
    await deletePromoCode();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.deleteButton.disabled = false;
  }
});

els.refreshButton.addEventListener("click", async () => {
  try {
    els.refreshButton.disabled = true;
    await loadPromoCodes();
    showStatus("Промокоды обновлены.");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.refreshButton.disabled = false;
  }
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
});

loadPromoCodes().catch((error) => {
  els.summaryStatus.textContent = "Не удалось загрузить промокоды";
  showStatus(error.message, true);
});
