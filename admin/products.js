const state = {
  products: [],
  selectedId: null
};

const els = {
  list: document.querySelector("#product-list"),
  count: document.querySelector("#product-count"),
  form: document.querySelector("#product-form"),
  title: document.querySelector("#editor-title"),
  preview: document.querySelector("#image-preview"),
  status: document.querySelector("#status"),
  newButton: document.querySelector("#new-product"),
  saveButton: document.querySelector("#save-product"),
  deleteButton: document.querySelector("#delete-product"),
  settingsForm: document.querySelector("#store-settings-form"),
  settingsStatus: document.querySelector("#store-settings-status"),
  saveSettingsButton: document.querySelector("#save-store-settings"),
  cdekCredentialsState: document.querySelector("#cdek-credentials-state"),
  yookassaCredentialsState: document.querySelector("#yookassa-credentials-state")
};


function renderCredentialFlag(element, label, ready) {
  if (!element) {
    return;
  }
  element.textContent = label + ": " + (ready ? "ключи есть" : "ключи не заданы");
  element.classList.toggle("is-ready", Boolean(ready));
  element.classList.toggle("is-missing", !ready);
}

function fillStoreSettings(settings) {
  if (!els.settingsForm) {
    return;
  }
  const form = els.settingsForm.elements;
  form.deliveryEnabled.checked = Boolean(settings.deliveryEnabled);
  form.paymentEnabled.checked = Boolean(settings.paymentEnabled);
  form.cdekFromLocationCode.value = settings.cdekFromLocationCode || "";
  form.cdekSenderPointCode.value = settings.cdekSenderPointCode || "";
  form.cdekTariffCode.value = settings.cdekTariffCode || 136;
  renderCredentialFlag(els.cdekCredentialsState, "CDEK", settings.hasCdekCredentials);
  renderCredentialFlag(els.yookassaCredentialsState, "ЮКасса", settings.hasYookassaCredentials);
  if (els.settingsStatus) {
    els.settingsStatus.textContent = settings.deliveryEnabled ? "Доставка включена" : "Доставка отключена";
  }
}

function storeSettingsPayload() {
  const form = els.settingsForm.elements;
  return {
    deliveryEnabled: form.deliveryEnabled.checked,
    paymentEnabled: form.paymentEnabled.checked,
    cdekFromLocationCode: form.cdekFromLocationCode.value,
    cdekSenderPointCode: form.cdekSenderPointCode.value,
    cdekTariffCode: Number(form.cdekTariffCode.value || 136)
  };
}

async function loadStoreSettings() {
  if (!els.settingsForm) {
    return;
  }
  const data = await fetchJson("/chat-api/admin/store-settings");
  if (data?.settings) {
    fillStoreSettings(data.settings);
  }
}

async function saveStoreSettings() {
  const data = await fetchJson("/chat-api/admin/store-settings", {
    method: "PATCH",
    body: JSON.stringify(storeSettingsPayload())
  });
  if (data?.settings) {
    fillStoreSettings(data.settings);
  }
  showStatus("Настройки оформления сохранены.");
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

function formatPrice(product) {
  if (product.priceOptions?.length) {
    return `от ${product.priceOptions[0].price.toLocaleString("ru-RU")} ₽`;
  }
  return product.price > 0 ? `${product.price.toLocaleString("ru-RU")} ₽` : "Цена по запросу";
}

function formatPriceOptionsText(product) {
  return (product.priceOptions || []).map((option) => `${option.unit} - ${option.price}`).join("\n");
}

function renderList() {
  els.count.textContent = `${state.products.length} товаров`;
  els.list.innerHTML = state.products.map((product) => `
    <button class="product-list__item${product.id === state.selectedId ? " is-selected" : ""}" type="button" data-id="${product.id}">
      <span class="product-list__image" style="--image: url('${escapeAttr(product.imageUrl || "/images/product-reishi.png")}')"></span>
      <span>
        <strong>${escapeHtml(product.title)}</strong>
        <span>${escapeHtml(product.category || product.subtitle || "Без категории")}</span>
        <span>${escapeHtml(formatPrice(product))}${product.isActive ? "" : " · скрыт"}</span>
      </span>
    </button>
  `).join("");
}

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

function emptyProduct() {
  return {
    id: "",
    title: "",
    subtitle: "Порошок",
    category: "Зерновой мицелий",
    shortDescription: "",
    description: "",
    benefits: [],
    dosage: "",
    composition: "",
    notice: "Не является лекарственным средством.",
    imageUrl: "",
    price: 800,
    unit: "100 г",
    priceOptions: [
      { unit: "100 г", price: 800 },
      { unit: "300 г", price: 2200 },
      { unit: "500 г", price: 3500 },
      { unit: "1000 г", price: 6000 }
    ],
    isActive: true,
    sortOrder: state.products.length
  };
}

function fillForm(product) {
  els.form.elements.id.value = product.id || "";
  els.form.elements.title.value = product.title || "";
  els.form.elements.subtitle.value = product.subtitle || "";
  els.form.elements.category.value = product.category || "";
  els.form.elements.price.value = product.price || 0;
  els.form.elements.unit.value = product.unit || "";
  els.form.elements.sortOrder.value = product.sortOrder ?? 0;
  els.form.elements.priceOptions.value = formatPriceOptionsText(product);
  els.form.elements.shortDescription.value = product.shortDescription || "";
  els.form.elements.description.value = product.description || "";
  els.form.elements.benefits.value = (product.benefits || []).join("\n");
  els.form.elements.dosage.value = product.dosage || "";
  els.form.elements.composition.value = product.composition || "";
  els.form.elements.notice.value = product.notice || "";
  els.form.elements.imageUrl.value = product.imageUrl || "";
  els.form.elements.imageFile.value = "";
  els.form.elements.isActive.checked = Boolean(product.isActive);
  els.preview.style.setProperty("--image", product.imageUrl ? `url('${product.imageUrl}')` : "none");
  els.title.textContent = product.id ? product.title : "Новый товар";
  els.deleteButton.disabled = !product.id;
}

function selectProduct(productId) {
  const product = state.products.find((item) => item.id === productId) || emptyProduct();
  state.selectedId = product.id || null;
  fillForm(product);
  renderList();
}

function formPayload() {
  const form = els.form.elements;
  return {
    title: form.title.value,
    subtitle: form.subtitle.value,
    category: form.category.value,
    price: Number(form.price.value || 0),
    unit: form.unit.value,
    priceOptions: form.priceOptions.value,
    sortOrder: Number(form.sortOrder.value || 0),
    shortDescription: form.shortDescription.value,
    description: form.description.value,
    benefits: form.benefits.value,
    dosage: form.dosage.value,
    composition: form.composition.value,
    notice: form.notice.value,
    imageUrl: form.imageUrl.value,
    isActive: form.isActive.checked
  };
}

async function loadProducts(selectedId = state.selectedId) {
  const data = await fetchJson("/chat-api/admin/products");
  if (!data) {
    return;
  }
  state.products = data.products;
  renderList();
  const nextId = selectedId && state.products.some((product) => product.id === selectedId)
    ? selectedId
    : state.products[0]?.id || null;
  if (nextId) {
    selectProduct(nextId);
  } else {
    selectProduct(null);
  }
}

async function saveProduct() {
  const id = Number(els.form.elements.id.value || 0);
  const payload = formPayload();
  const url = id ? `/chat-api/admin/products/${id}` : "/chat-api/admin/products";
  const method = id ? "PATCH" : "POST";
  const data = await fetchJson(url, {
    method,
    body: JSON.stringify(payload)
  });
  if (!data) {
    return;
  }

  const file = els.form.elements.imageFile.files[0];
  let product = data.product;
  if (file) {
    const body = new FormData();
    body.append("image", file);
    const imageData = await fetchJson(`/chat-api/admin/products/${product.id}/image`, {
      method: "POST",
      body
    });
    product = imageData.product;
  }

  await loadProducts(product.id);
  showStatus("Товар сохранён.");
}

async function deleteProduct() {
  const id = Number(els.form.elements.id.value || 0);
  if (!id) {
    return;
  }
  const product = state.products.find((item) => item.id === id);
  if (!window.confirm(`Удалить товар «${product?.title || "без названия"}»?`)) {
    return;
  }
  await fetchJson(`/chat-api/admin/products/${id}`, { method: "DELETE" });
  state.selectedId = null;
  await loadProducts();
  showStatus("Товар удалён.");
}

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) {
    return;
  }
  selectProduct(Number(button.dataset.id));
});

els.newButton.addEventListener("click", () => {
  state.selectedId = null;
  fillForm(emptyProduct());
  renderList();
});

els.saveButton.addEventListener("click", async () => {
  try {
    els.saveButton.disabled = true;
    await saveProduct();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.saveButton.disabled = false;
  }
});

if (els.saveSettingsButton) {
  els.saveSettingsButton.addEventListener("click", async () => {
    try {
      els.saveSettingsButton.disabled = true;
      await saveStoreSettings();
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      els.saveSettingsButton.disabled = false;
    }
  });
}

els.deleteButton.addEventListener("click", async () => {
  try {
    els.deleteButton.disabled = true;
    await deleteProduct();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    els.deleteButton.disabled = false;
  }
});

els.form.elements.imageUrl.addEventListener("input", () => {
  const imageUrl = els.form.elements.imageUrl.value.trim();
  els.preview.style.setProperty("--image", imageUrl ? `url('${imageUrl}')` : "none");
});

els.form.elements.imageFile.addEventListener("change", () => {
  const file = els.form.elements.imageFile.files[0];
  if (!file) {
    return;
  }
  els.preview.style.setProperty("--image", `url('${URL.createObjectURL(file)}')`);
});

loadProducts().catch((error) => {
  showStatus(error.message, true);
  fillForm(emptyProduct());
});
