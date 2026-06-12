const viewMode = document.body.dataset.adminView || "orders";

const state = {
  records: [],
  selectedId: null
};

const els = {
  list: document.querySelector("#record-list"),
  count: document.querySelector("#record-count"),
  title: document.querySelector("#record-title"),
  detail: document.querySelector("#record-detail"),
  summary: document.querySelector("#orders-summary"),
  summaryStatus: document.querySelector("#orders-summary-status"),
  refreshButton: document.querySelector("#refresh-orders"),
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

function money(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₽`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (["paid", "succeeded"].includes(normalized)) return "is-paid";
  if (["payment_pending", "pending", "waiting_for_capture"].includes(normalized)) return "is-pending";
  if (["payment_canceled", "canceled"].includes(normalized)) return "is-canceled";
  return "";
}

function statusLabel(value, type = "order") {
  const normalized = String(value || "").toLowerCase();
  if (type === "payment") {
    if (normalized === "succeeded") return "Оплачен";
    if (normalized === "pending") return "Ожидает оплаты";
    if (normalized === "waiting_for_capture") return "Ожидает подтверждения";
    if (normalized === "canceled") return "Отменён";
    return value || "—";
  }
  if (normalized === "paid") return "Оплачен";
  if (normalized === "payment_pending") return "Ожидает оплаты";
  if (normalized === "payment_canceled") return "Оплата отменена";
  if (normalized === "created") return "Создан";
  return value || "—";
}

function filteredRecords() {
  if (viewMode === "payments") {
    return state.records.filter((record) => record.paymentProvider || record.paymentId || record.paymentStatus || record.paymentUrl);
  }
  return state.records;
}

function renderSummary(records) {
  const totalOrders = records.length;
  const paidOrders = records.filter((record) => record.status === "paid").length;
  const pendingOrders = records.filter((record) => record.status === "payment_pending").length;
  const totalRevenue = records
    .filter((record) => record.status === "paid")
    .reduce((sum, record) => sum + Number(record.total || 0), 0);

  const cards = viewMode === "payments"
    ? [
        ["Платежей", totalOrders],
        ["Оплачено", paidOrders],
        ["В ожидании", pendingOrders],
        ["Оплачено на сумму", money(totalRevenue)]
      ]
    : [
        ["Заказов", totalOrders],
        ["Оплачено", paidOrders],
        ["Ожидают оплаты", pendingOrders],
        ["Выручка", money(totalRevenue)]
      ];

  els.summary.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `).join("");
}

function renderList() {
  const records = filteredRecords();
  els.count.textContent = `${records.length} ${viewMode === "payments" ? "платежей" : "заказов"}`;
  if (!records.length) {
    els.list.innerHTML = `<p class="record-empty">${viewMode === "payments" ? "Платежей пока нет." : "Заказов пока нет."}</p>`;
    els.detail.innerHTML = `<p class="record-empty">${viewMode === "payments" ? "Когда появятся оплаты через ЮКассу, они будут здесь." : "Когда появятся заказы, они будут здесь."}</p>`;
    return;
  }
  els.list.innerHTML = records.map((record) => `
    <button class="record-list__item${record.id === state.selectedId ? " is-selected" : ""}" type="button" data-id="${record.id}">
      <span class="record-list__row">
        <strong>${escapeHtml(record.publicId)}</strong>
        <span class="status-pill ${statusTone(viewMode === "payments" ? record.paymentStatus : record.status)}">${escapeHtml(statusLabel(viewMode === "payments" ? record.paymentStatus : record.status, viewMode === "payments" ? "payment" : "order"))}</span>
      </span>
      <span>${escapeHtml(record.customerName || "Без имени")}</span>
      <span>${escapeHtml(formatDate(record.createdAt))}</span>
      <span>${escapeHtml(money(record.total || 0))}</span>
    </button>
  `).join("");
}

function detailSection(title, rows) {
  const content = rows
    .filter((row) => row[1] !== undefined && row[1] !== null && row[1] !== "")
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`)
    .join("");
  if (!content) return "";
  return `
    <section class="detail-section">
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderOrderItems(items) {
  if (!items?.length) return "";
  return `
    <section class="detail-section">
      <h3>Состав заказа</h3>
      <div class="detail-items">
        ${items.map((item) => `
          <article class="detail-item">
            <strong>${escapeHtml(item.title || item.slug)}</strong>
            <span>${escapeHtml(`${item.quantity} × ${item.unit || ""}`.trim())}</span>
            <span>${escapeHtml(money(item.amount || item.price * item.quantity || 0))}</span>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDetail(record) {
  if (!record) {
    els.title.textContent = viewMode === "payments" ? "Платёж не выбран" : "Заказ не выбран";
    els.detail.innerHTML = `<p class="record-empty">Выберите запись слева.</p>`;
    return;
  }

  els.title.textContent = record.publicId;
  const paymentLink = record.paymentUrl
    ? `<a class="button" href="${escapeHtml(record.paymentUrl)}" target="_blank" rel="noopener">Открыть платёж</a>`
    : "";

  els.detail.innerHTML = `
    <div class="detail-toolbar">
      <span class="status-pill ${statusTone(record.status)}">${escapeHtml(statusLabel(record.status, "order"))}</span>
      <span class="status-pill ${statusTone(record.paymentStatus)}">${escapeHtml(statusLabel(record.paymentStatus, "payment"))}</span>
      ${paymentLink}
    </div>
    ${detailSection("Покупатель", [
      ["Имя", record.customerName],
      ["Телефон", record.customerPhone],
      ["Email", record.customerEmail],
      ["Комментарий", record.customerComment || "—"]
    ])}
    ${renderOrderItems(record.items)}
    ${detailSection("Доставка", [
      ["Провайдер", record.delivery?.provider || "Без доставки"],
      ["Город", record.delivery?.cityName || "—"],
      ["Пункт", record.delivery?.pointName || "—"],
      ["Адрес", record.delivery?.pointAddress || "—"],
      ["Стоимость", money(record.deliveryPrice || 0)]
    ])}
    ${detailSection(viewMode === "payments" ? "Платёж" : "Оплата", [
      ["Провайдер", record.paymentProvider || "—"],
      ["Статус оплаты", statusLabel(record.paymentStatus, "payment")],
      ["Payment ID", record.paymentId || "—"],
      ["Сумма", money(record.total || 0)],
      ["Создан", formatDate(record.createdAt)],
      ["Обновлён", formatDate(record.updatedAt)]
    ])}
  `;
}

function selectRecord(id) {
  const record = filteredRecords().find((item) => item.id === id) || null;
  state.selectedId = record?.id || null;
  renderList();
  renderDetail(record);
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

async function fetchJson(url) {
  const response = await fetch(url, { credentials: "same-origin" });
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

async function loadOrders() {
  const data = await fetchJson("/chat-api/admin/orders");
  if (!data) return;
  state.records = data.orders || [];
  renderSummary(state.records);
  renderList();
  els.summaryStatus.textContent = viewMode === "payments" ? "Платежи обновлены" : "Заказы обновлены";
  const visible = filteredRecords();
  const nextId = visible.some((record) => record.id === state.selectedId) ? state.selectedId : visible[0]?.id || null;
  selectRecord(nextId);
}

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  selectRecord(Number(button.dataset.id));
});

els.refreshButton?.addEventListener("click", async () => {
  try {
    els.refreshButton.disabled = true;
    await loadOrders();
    showStatus(viewMode === "payments" ? "Платежи обновлены." : "Заказы обновлены.");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.refreshButton.disabled = false;
  }
});

loadOrders().catch((error) => {
  els.summaryStatus.textContent = "Не удалось загрузить данные";
  showStatus(error.message, true);
});
