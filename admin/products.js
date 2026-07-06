const state = {
  products: [],
  selectedId: null,
  deliveryTest: { city: null, points: [] }
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
  yookassaCredentialsState: document.querySelector("#yookassa-credentials-state"),
  deliveryTestQuery: document.querySelector("#delivery-test-query"),
  deliveryTestCities: document.querySelector("#delivery-test-cities"),
  deliveryTestPoint: document.querySelector("#delivery-test-point"),
  deliveryTestWeight: document.querySelector("#delivery-test-weight"),
  calculateDeliveryButton: document.querySelector("#calculate-delivery"),
  deliveryTestResult: document.querySelector("#delivery-test-result"),
  deliveryTestDebug: document.querySelector("#delivery-test-debug")
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
  form.cdekPackageLength.value = settings.cdekPackageLength || 20;
  form.cdekPackageWidth.value = settings.cdekPackageWidth || 15;
  form.cdekPackageHeight.value = settings.cdekPackageHeight || 10;
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
    cdekTariffCode: Number(form.cdekTariffCode.value || 136),
    cdekPackageLength: Number(form.cdekPackageLength.value || 20),
    cdekPackageWidth: Number(form.cdekPackageWidth.value || 15),
    cdekPackageHeight: Number(form.cdekPackageHeight.value || 10)
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

function setDeliveryTestResult(message, isError = false) {
  if (!els.deliveryTestResult) return;
  els.deliveryTestResult.innerHTML = message;
  els.deliveryTestResult.classList.toggle("is-error", Boolean(isError));
  setDeliveryTestDebug(null);
}

function formatJson(value) {
  return escapeHtml(JSON.stringify(value || {}, null, 2));
}

function setDeliveryTestDebug(debug) {
  if (!els.deliveryTestDebug) return;
  if (!debug) {
    els.deliveryTestDebug.hidden = true;
    els.deliveryTestDebug.innerHTML = "";
    return;
  }
  els.deliveryTestDebug.hidden = false;
  els.deliveryTestDebug.innerHTML = `
    <div>
      <strong>Запрос в CDEK</strong>
      <pre>${formatJson(debug.request)}</pre>
    </div>
    <div>
      <strong>Ответ CDEK</strong>
      <pre>${formatJson(debug.response)}</pre>
    </div>
  `;
}

function renderDeliveryTestCities(cities) {
  if (!els.deliveryTestCities) return;
  els.deliveryTestCities.innerHTML = cities.map((city) => {
    const selected = String(state.deliveryTest.city?.code || "") === String(city.code);
    return `<button type="button" class="${selected ? "is-selected" : ""}" data-delivery-city-code="${escapeHtml(city.code)}" data-delivery-city-name="${escapeHtml(city.name)}" data-delivery-city-region="${escapeHtml(city.region || "")}">${escapeHtml(city.name)}${city.region ? `, ${escapeHtml(city.region)}` : ""}</button>`;
  }).join("");
}

function renderDeliveryTestPoints(points) {
  if (!els.deliveryTestPoint) return;
  state.deliveryTest.points = points;
  els.deliveryTestPoint.disabled = !points.length;
  els.deliveryTestPoint.innerHTML = points.length
    ? '<option value="">Выберите ПВЗ</option>' + points.map((point) => `<option value="${escapeHtml(point.code)}">${escapeHtml(point.name)} · ${escapeHtml(point.address)}</option>`).join("")
    : '<option value="">ПВЗ не найдены</option>';
}

async function searchDeliveryTestCities() {
  const query = els.deliveryTestQuery?.value.trim() || "";
  state.deliveryTest.city = null;
  renderDeliveryTestPoints([]);
  if (query.length < 2) {
    renderDeliveryTestCities([]);
    setDeliveryTestResult("Введите город или адрес, затем выберите ПВЗ.");
    return;
  }
  setDeliveryTestResult("Ищем города CDEK...");
  const data = await fetchJson(`/chat-api/delivery/cities?q=${encodeURIComponent(query)}`);
  const cities = data.cities || [];
  renderDeliveryTestCities(cities);
  setDeliveryTestResult(cities.length ? "Выберите город из найденных вариантов." : "Города не найдены.", !cities.length);
}

async function selectDeliveryTestCity(city) {
  state.deliveryTest.city = city;
  if (els.deliveryTestQuery) {
    els.deliveryTestQuery.value = city.region ? `${city.name}, ${city.region}` : city.name;
  }
  renderDeliveryTestCities([city]);
  setDeliveryTestResult("Загружаем ПВЗ CDEK...");
  const data = await fetchJson(`/chat-api/delivery/points?cityCode=${encodeURIComponent(city.code)}`);
  const points = data.points || [];
  renderDeliveryTestPoints(points);
  setDeliveryTestResult(points.length ? "Выберите ПВЗ и нажмите расчет." : "В этом городе ПВЗ не найдены.", !points.length);
}

async function calculateDeliveryTest() {
  const city = state.deliveryTest.city;
  const point = state.deliveryTest.points.find((item) => item.code === els.deliveryTestPoint?.value);
  const weightGrams = Math.max(1, Number(els.deliveryTestWeight?.value || 100));
  if (!city || !point) {
    setDeliveryTestResult("Выберите город и ПВЗ CDEK.", true);
    return;
  }
  setDeliveryTestResult("Считаем доставку CDEK...");
  const data = await fetchJson("/chat-api/admin/delivery/calculate", {
    method: "POST",
    body: JSON.stringify({ cityCode: city.code, deliveryPointCode: point.code, weightGrams })
  });
  const delivery = data.delivery || {};
  const pkg = delivery.package || {};
  const period = delivery.periodMin ? `${delivery.periodMin}-${delivery.periodMax || delivery.periodMin} дн.` : "срок не указан";
  setDeliveryTestResult(`<strong>${Number(delivery.price || 0).toLocaleString("ru-RU")} ₽</strong> · ${period}<br>ПВЗ отправления: ${escapeHtml(delivery.shipmentPointCode || "не указан")} · ПВЗ получения: ${escapeHtml(delivery.deliveryPointCode || point.code)}<br>Тариф: ${escapeHtml(delivery.tariffCode || "")} · Вес: ${escapeHtml(pkg.weight || weightGrams)} г · Габариты: ${escapeHtml(pkg.length || "")}×${escapeHtml(pkg.width || "")}×${escapeHtml(pkg.height || "")} см`);
  setDeliveryTestDebug(data.cdekDebug || delivery.debug);
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
    const error = new Error(data.error || "Ошибка запроса.");
    error.data = data;
    throw error;
  }
  return data;
}

function formatPrice(product) {
  const discount = Number(product.discountPercent || 0);
  if (product.priceOptions?.length) {
    const first = product.priceOptions[0];
    const baseAmount = Number(first.originalPrice ?? first.price ?? 0);
    const label = `от ${baseAmount.toLocaleString("ru-RU")} ₽`;
    return discount > 0 ? `${label} · -${discount}%` : label;
  }
  return product.price > 0 ? `${product.price.toLocaleString("ru-RU")} ₽${discount > 0 ? ` · -${discount}%` : ""}` : "Цена по запросу";
}

function formatPriceOptionDimensions(option, product) {
  const length = option.packageLength || product.packageLength || 20;
  const width = option.packageWidth || product.packageWidth || 15;
  const height = option.packageHeight || product.packageHeight || 10;
  return `${length}.${width}.${height}`;
}

function formatPriceOptionsText(product) {
  return (product.priceOptions || []).map((option) => `${option.unit} - ${option.price} - ${formatPriceOptionDimensions(option, product)}`).join("\n");
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
    discountPercent: 0,
    unit: "100 г",
    priceOptions: [
      { unit: "100 г", price: 800, packageLength: 20, packageWidth: 15, packageHeight: 10 },
      { unit: "300 г", price: 2200, packageLength: 60, packageWidth: 45, packageHeight: 30 },
      { unit: "500 г", price: 3500, packageLength: 100, packageWidth: 75, packageHeight: 50 },
      { unit: "1000 г", price: 6000, packageLength: 200, packageWidth: 150, packageHeight: 100 }
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
  els.form.elements.discountPercent.value = product.discountPercent || 0;
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
    discountPercent: Number(form.discountPercent.value || 0),
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

let deliverySearchTimer = null;
if (els.deliveryTestQuery) {
  els.deliveryTestQuery.addEventListener("input", () => {
    window.clearTimeout(deliverySearchTimer);
    deliverySearchTimer = window.setTimeout(() => {
      searchDeliveryTestCities().catch((error) => setDeliveryTestResult(error.message, true));
    }, 360);
  });
}

if (els.deliveryTestCities) {
  els.deliveryTestCities.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delivery-city-code]");
    if (!button) return;
    selectDeliveryTestCity({
      code: button.dataset.deliveryCityCode,
      name: button.dataset.deliveryCityName,
      region: button.dataset.deliveryCityRegion
    }).catch((error) => setDeliveryTestResult(error.message, true));
  });
}

if (els.calculateDeliveryButton) {
  els.calculateDeliveryButton.addEventListener("click", async () => {
    try {
      els.calculateDeliveryButton.disabled = true;
      await calculateDeliveryTest();
    } catch (error) {
      setDeliveryTestResult(error.message, true);
      setDeliveryTestDebug(error.data?.cdekDebug || error.data?.delivery?.debug);
    } finally {
      els.calculateDeliveryButton.disabled = false;
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

loadStoreSettings().catch((error) => {
  if (els.settingsStatus) {
    els.settingsStatus.textContent = "Не удалось загрузить настройки.";
  }
  showStatus(error.message, true);
});

loadProducts().catch((error) => {
  showStatus(error.message, true);
  fillForm(emptyProduct());
});
