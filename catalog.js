(() => {
  const grid = document.querySelector("[data-product-grid]");
  const modal = document.querySelector("[data-product-modal]");
  if (!grid || !modal) return;

  const products = new Map();
  const cartKey = "shamanchik_cart_v1";
  const fallbackImage = "/images/product-reishi.png";
  const whatsappPhone = "79871355371";
  const state = {
    cart: loadCart(),
    settings: { deliveryEnabled: true, paymentEnabled: true, cdekSearchReady: false, cdekReady: false, yookassaReady: false },
    checkout: { city: null, points: [], selectedPoint: null, delivery: null },
    promo: { code: "", applied: null, discountAmount: 0, message: "", isError: false }
  };

  const modalEls = {
    image: modal.querySelector("[data-product-modal-image]"),
    title: modal.querySelector("[data-product-modal-title]"),
    meta: modal.querySelector("[data-product-modal-meta]"),
    price: modal.querySelector("[data-product-modal-price]"),
    description: modal.querySelector("[data-product-modal-description]"),
    facts: modal.querySelector("[data-product-modal-facts]"),
    order: modal.querySelector("[data-product-modal-order]")
  };

  const cartEls = createCartUi();
  let cartHighlightTimer = null;

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

  function whatsappUrl(product, unit) {
    const option = priceOptions(product).find((item) => item.unit === unit) || firstOption(product);
    const details = [product.title, option?.unit, Number(option?.price) ? money(option.price) : ""].filter(Boolean).join(", ");
    const text = `Здравствуйте, хочу приобрести: ${details}.`;
    return `https://api.whatsapp.com/send/?phone=${whatsappPhone}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
  }

  function canUseCheckoutPayment() {
    return Boolean(state.settings.paymentEnabled && state.settings.yookassaReady);
  }

  function canCheckoutProduct(product, unit = "") {
    const option = priceOptions(product).find((item) => item.unit === unit) || firstOption(product);
    return canUseCheckoutPayment() && Number(option?.price || 0) > 0;
  }

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (/^(\/[a-z0-9._/-]+|images\/|https?:\/\/)/i.test(url)) return url;
    return fallbackImage;
  }

  function setImage(element, imageUrl) {
    element.style.setProperty("--image", `url("${safeImageUrl(imageUrl).replace(/"/g, "%22")}")`);
  }

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(cartKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(state.cart));
  }

  function modalImagePosition(product) {
    const slug = String(product.slug || "").toLowerCase();
    if (slug.includes("шиитаке")) return "64% center";
    if (slug.includes("мейтаке")) return "61% center";
    if (slug.includes("ежовика")) return "54% center";
    if (slug.includes("кордицепса")) return "48% center";
    return "52% center";
  }

  function cardImagePosition(product) {
    const slug = String(product.slug || "").toLowerCase();
    if (slug.includes("шиитаке")) return "66% center";
    if (slug.includes("мейтаке")) return "63% center";
    if (slug.includes("ежовика")) return "55% center";
    if (slug.includes("кордицепса")) return "48% center";
    if (slug.includes("рейши")) return "53% center";
    if (slug.includes("траметеса")) return "52% center";
    return "center";
  }

  function setModalImage(product) {
    setImage(modalEls.image, product.imageUrl);
    modalEls.image.style.setProperty("--modal-pos", modalImagePosition(product));
    modalEls.image.style.setProperty("--modal-size", "auto 96%");
  }

  function priceOptions(product) {
    if (product.priceOptions?.length) return product.priceOptions;
    return [{ unit: product.unit || product.subtitle || "шт", price: Number(product.price || 0) }];
  }

  function productDiscountPercent(product) {
    return Math.max(0, Number(product?.discountPercent || 0));
  }

  function firstOption(product) {
    return priceOptions(product)[0];
  }

  function originalFirstOption(product) {
    if (product.originalPriceOptions?.length) return product.originalPriceOptions[0];
    const first = firstOption(product);
    return { unit: first?.unit || product.unit || "", price: Number(product.originalPrice || first?.price || 0) };
  }

  function formatPrice(product) {
    const option = firstOption(product);
    if (!Number(option?.price)) return "По запросу";
    return product.priceOptions?.length ? `от ${money(option.price)}` : money(option.price);
  }

  function formatOriginalPrice(product) {
    const option = originalFirstOption(product);
    if (!Number(option?.price)) return "";
    return product.originalPriceOptions?.length ? `от ${money(option.price)}` : money(option.price);
  }

  function formatPriceOption(option) {
    const original = Number(option.originalPrice || option.price || 0);
    return original > Number(option.price || 0)
      ? `${option.unit} - ${money(option.price)} вместо ${money(original)}`
      : `${option.unit} - ${money(option.price)}`;
  }

  function formatProductUnits(product) {
    if (product.priceOptions?.length) return product.priceOptions.map((option) => option.unit).join(" / ");
    return product.unit || product.subtitle || "";
  }

  function priceMarkup(product) {
    const current = formatPrice(product);
    const original = formatOriginalPrice(product);
    const discount = productDiscountPercent(product);
    if (!discount || !original || original === current) {
      return `<span class="price">${escapeHtml(current)}</span>`;
    }
    return `<span class="price-stack"><span class="price price--old">${escapeHtml(original)}</span><span class="price">${escapeHtml(current)}</span></span><span class="discount-badge">-${discount}%</span>`;
  }

  function modalPriceMarkup(product) {
    const current = formatPrice(product);
    const original = formatOriginalPrice(product);
    const discount = productDiscountPercent(product);
    if (!discount || !original || original === current) {
      return `<span class="price price--modal">${escapeHtml(current)}</span>`;
    }
    return `<div class="modal-price"><span class="price price--old">${escapeHtml(original)}</span><span class="price price--modal">${escapeHtml(current)}</span><span class="discount-badge">-${discount}%</span></div>`;
  }

  function normalizedPromoCode(value) {
    return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
  }

  function cartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryPrice = state.checkout.delivery?.price || 0;
    const discountAmount = Math.min(subtotal, Math.max(0, Number(state.promo.discountAmount || 0)));
    return { subtotal, discountAmount, deliveryPrice, total: subtotal - discountAmount + deliveryPrice };
  }

  function setPromoMessage(message, isError = false) {
    state.promo.message = String(message || "");
    state.promo.isError = Boolean(isError);
  }

  function renderPromoState() {
    if (!cartEls.promoInput) return;
    const applied = state.promo.applied;
    const currentCode = normalizedPromoCode(cartEls.promoInput.value);
    const appliedCode = normalizedPromoCode(applied?.code);
    if (currentCode !== appliedCode) {
      cartEls.promoInput.value = state.promo.code || "";
    }
    cartEls.promoInput.classList.toggle("is-applied", Boolean(applied));
    cartEls.promoApplyButton.textContent = applied ? "Применён" : "Применить";
    cartEls.promoApplyButton.disabled = !state.cart.length;
    cartEls.promoNote.textContent = state.promo.message || "Введите промокод, чтобы пересчитать итог заказа.";
    cartEls.promoNote.classList.toggle("is-error", Boolean(state.promo.message && state.promo.isError));
    cartEls.promoNote.classList.toggle("is-success", Boolean(state.promo.message && !state.promo.isError && applied));
  }

  function clearPromoState({ keepCode = true, message = "", isError = false } = {}) {
    state.promo.applied = null;
    state.promo.discountAmount = 0;
    state.promo.code = keepCode ? normalizedPromoCode(cartEls?.promoInput?.value || state.promo.code) : "";
    setPromoMessage(message, isError);
  }

  async function syncPromoState({ silent = false } = {}) {
    const code = normalizedPromoCode(cartEls?.promoInput?.value || state.promo.code);
    state.promo.code = code;
    if (!code) {
      clearPromoState({ keepCode: true, message: silent ? "" : "Промокод не указан." });
      renderPromoState();
      renderSummary();
      return true;
    }
    if (!state.cart.length) {
      clearPromoState({ keepCode: true, message: "" });
      renderPromoState();
      renderSummary();
      return false;
    }
    try {
      cartEls.promoApplyButton.disabled = true;
      cartEls.promoApplyButton.textContent = "Проверяем...";
      const data = await fetchJson("/chat-api/promocodes/preview", {
        method: "POST",
        body: JSON.stringify({ code, items: cartPayload() })
      });
      state.promo.applied = data.promo || null;
      state.promo.discountAmount = Number(data.discountAmount || 0);
      state.promo.code = code;
      setPromoMessage(
        state.promo.discountAmount > 0
          ? `Промокод ${code} применён. Скидка ${money(state.promo.discountAmount)}.`
          : `Промокод ${code} не даёт скидку для этой корзины.`,
        !(state.promo.discountAmount > 0)
      );
      renderPromoState();
      renderSummary();
      return true;
    } catch (error) {
      clearPromoState({ keepCode: true, message: error.message, isError: true });
      renderPromoState();
      renderSummary();
      return false;
    } finally {
      if (cartEls.promoApplyButton) {
        cartEls.promoApplyButton.disabled = !state.cart.length;
        cartEls.promoApplyButton.textContent = state.promo.applied ? "Применён" : "Применить";
      }
    }
  }

  function handleCartChanged() {
    state.checkout.delivery = null;
    if (state.promo.applied) {
      void syncPromoState({ silent: true });
    } else {
      clearPromoState({ keepCode: true, message: state.promo.code ? "Изменили корзину. Нажмите «Применить», чтобы пересчитать скидку." : "" });
      renderPromoState();
      renderSummary();
    }
  }

  function canCheckoutCartItem(item) {
    const product = products.get(item.slug);
    if (product) {
      return canCheckoutProduct(product, item.unit);
    }
    return Number(item.price || 0) > 0;
  }

  function addToCart(slug, unit) {
    const product = products.get(slug);
    if (!product) return;
    const option = priceOptions(product).find((item) => item.unit === unit) || firstOption(product);
    if (!canCheckoutProduct(product, option.unit)) {
      window.open(whatsappUrl(product, option.unit), "_blank", "noopener");
      return;
    }
    const key = `${slug}::${option.unit}`;
    const existing = state.cart.find((item) => item.key === key);
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({ key, slug, title: product.title, unit: option.unit, price: Number(option.price || 0), imageUrl: product.imageUrl, quantity: 1 });
    }
    handleCartChanged();
    saveCart();
    renderCart();
    highlightCartButton();
  }

  function setCartQuantity(key, quantity) {
    const item = state.cart.find((entry) => entry.key === key);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(99, quantity));
    handleCartChanged();
    saveCart();
    renderCart();
  }

  function removeCartItem(key) {
    state.cart = state.cart.filter((item) => item.key !== key);
    handleCartChanged();
    saveCart();
    renderCart();
  }

  function createCartUi() {
    const root = document.createElement("div");
    root.className = "cart-shell";
    root.innerHTML = `
      <button class="cart-fab" type="button" data-cart-open aria-label="Открыть корзину">
        <svg class="icon"><use href="#icon-cart"></use></svg>
        <span data-cart-count>0</span>
      </button>
      <div class="cart-panel" data-cart-panel hidden>
        <div class="cart-panel__backdrop" data-cart-close></div>
        <aside class="cart-panel__drawer" aria-label="Корзина">
          <header class="cart-panel__head">
            <div><p class="cart-panel__eyebrow">Оформление</p><h2>Корзина</h2></div>
            <button class="product-modal__close" type="button" data-cart-close aria-label="Закрыть">×</button>
          </header>
          <div class="cart-panel__body">
            <div class="cart-list" data-cart-list></div>
            <form class="checkout-form" data-checkout-form>
              <h3>Покупатель</h3>
              <div class="checkout-grid">
                <label><span>Имя</span><input name="name" type="text" autocomplete="name" required></label>
                <label><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" required></label>
              </div>
              <label><span>Email для чека</span><input name="email" type="email" autocomplete="email" placeholder="Обязателен для онлайн-оплаты"></label>
              <label><span>Комментарий</span><textarea name="comment" rows="3" placeholder="Удобное время, пожелания к заказу"></textarea></label>
              <section class="checkout-promo">
                <h3>Промокод</h3>
                <div class="checkout-inline">
                  <input name="promoCode" type="text" autocomplete="off" placeholder="Например SOMA10">
                  <button class="button" type="button" data-promo-apply>Применить</button>
                </div>
                <p class="checkout-note checkout-note--promo" data-promo-note>Введите промокод, чтобы пересчитать итог заказа.</p>
              </section>
              <section class="checkout-delivery" data-delivery-section>
                <h3>Доставка CDEK</h3>
                <label><span>Город</span><input name="city" type="text" autocomplete="off" placeholder="Начните вводить город"></label>
                <div class="checkout-options" data-city-options></div>
                <label><span>Пункт выдачи</span><select name="point" disabled><option value="">Сначала выберите город</option></select></label>
                <p class="checkout-note" data-delivery-note>Стоимость доставки рассчитается после выбора пункта выдачи.</p>
              </section>
              <div class="cart-summary" data-cart-summary></div>
              <p class="checkout-error" data-checkout-error hidden></p>
              <button class="button button--gold checkout-submit" type="submit">Перейти к оплате</button>
            </form>
          </div>
        </aside>
      </div>
    `;
    document.body.appendChild(root);
    return {
      root,
      fab: root.querySelector("[data-cart-open]"),
      panel: root.querySelector("[data-cart-panel]"),
      count: root.querySelector("[data-cart-count]"),
      list: root.querySelector("[data-cart-list]"),
      form: root.querySelector("[data-checkout-form]"),
      promoInput: root.querySelector('input[name="promoCode"]'),
      promoApplyButton: root.querySelector("[data-promo-apply]"),
      promoNote: root.querySelector("[data-promo-note]"),
      deliverySection: root.querySelector("[data-delivery-section]"),
      cityInput: root.querySelector('input[name="city"]'),
      cityOptions: root.querySelector("[data-city-options]"),
      pointSelect: root.querySelector('select[name="point"]'),
      deliveryNote: root.querySelector("[data-delivery-note]"),
      summary: root.querySelector("[data-cart-summary]"),
      error: root.querySelector("[data-checkout-error]")
    };
  }

  function openCart() {
    cartEls.panel.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    cartEls.panel.hidden = true;
    if (modal.hidden) document.body.style.overflow = "";
  }

  function highlightCartButton() {
    window.clearTimeout(cartHighlightTimer);
    cartEls.fab.classList.remove("is-highlighted");
    void cartEls.fab.offsetWidth;
    cartEls.fab.classList.add("is-highlighted");
    cartHighlightTimer = window.setTimeout(() => {
      cartEls.fab.classList.remove("is-highlighted");
    }, 900);
  }

  function renderCardPrices(product) {
    if (!product.priceOptions?.length) return "";
    return `<div class="product-card__prices" data-product-open="${escapeHtml(product.slug)}" role="button" tabindex="0">${product.priceOptions.map((option) => `<span>${escapeHtml(formatPriceOption(option))}</span>`).join("")}</div>`;
  }

  function categoryKey(value) {
    return String(value || "").trim().toLocaleLowerCase("ru-RU");
  }

  function categoryMeta(category) {
    const key = categoryKey(category);
    const known = {
      "зерновой мицелий": { title: "Зерновой мицелий", banner: "" },
      "сома": { title: "Сома", banner: "images/banner1.jpg" },
      "плодовые тела": { title: "Плодовые тела", banner: "images/5292189051106566349.jpg" },
      "мази": { title: "Грибные мази", banner: "images/5292189051106566348.jpg" },
      "масла": { title: "Сыродавленные масла", banner: "images/5292189051106566347.jpg" },
      "масла, пасты и мёд": { title: "Масла, пасты и мёд", banner: "" },
      "медовая продукция": { title: "Медовая продукция", banner: "" }
    };
    return {
      key,
      title: known[key]?.title || String(category || "Каталог"),
      banner: known[key]?.banner || ""
    };
  }

  function categoryOrder(key) {
    const order = [
      "зерновой мицелий",
      "сома",
      "плодовые тела",
      "мази",
      "масла",
      "масла, пасты и мёд",
      "медовая продукция"
    ];
    const index = order.indexOf(key);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  function categoryHeading(title) {
    return `
      <div class="product-category-heading">
        <h3>${escapeHtml(title)}</h3>
      </div>`;
  }

  function categoryBanner(imageUrl) {
    return `
      <div class="product-category-banner" aria-hidden="true">
        <img src="${escapeHtml(imageUrl)}" alt="">
      </div>`;
  }

  function productCard(product) {
    const description = product.shortDescription || product.description || product.composition || "";
    const option = firstOption(product);
    return `
      <article class="product-card" data-product-slug="${escapeHtml(product.slug)}">
        <div class="product-card__image" data-product-image="${escapeHtml(product.imageUrl || "")}" data-product-image-slug="${escapeHtml(product.slug)}" data-product-open="${escapeHtml(product.slug)}" role="button" tabindex="0" aria-label="Подробнее о ${escapeHtml(product.title)}"></div>
        <div class="product-card__body">
          <h3 data-product-open="${escapeHtml(product.slug)}" role="button" tabindex="0">${escapeHtml(product.title)}</h3>
          <p data-product-open="${escapeHtml(product.slug)}" role="button" tabindex="0">${escapeHtml(formatProductUnits(product))}</p>
          <p data-product-open="${escapeHtml(product.slug)}" role="button" tabindex="0">${escapeHtml(description.slice(0, 118))}${description.length > 118 ? "..." : ""}</p>
          ${renderCardPrices(product)}
          <button class="product-card__details" type="button" data-product-detail="${escapeHtml(product.slug)}">Подробнее</button>
          <div class="product-card__buy">
            <div class="product-card__price-wrap">${priceMarkup(product)}</div>
            <button class="cart-button" type="button" data-cart-add="${escapeHtml(product.slug)}" data-cart-unit="${escapeHtml(option.unit)}" aria-label="Добавить ${escapeHtml(product.title)} в корзину"><svg class="icon"><use href="#icon-cart"></use></svg></button>
          </div>
        </div>
      </article>`;
  }

  function renderProducts(items) {
    if (!items.length) {
      grid.innerHTML = '<p class="product-card__empty">Каталог скоро появится.</p>';
      return;
    }
    products.clear();
    for (const product of items) products.set(product.slug, product);
    const groups = new Map();
    for (const product of items) {
      const meta = categoryMeta(product.category);
      if (!groups.has(meta.key)) {
        groups.set(meta.key, { meta, items: [] });
      }
      groups.get(meta.key).items.push(product);
    }
    const markup = Array.from(groups.values())
      .sort((left, right) => {
        const rankDiff = categoryOrder(left.meta.key) - categoryOrder(right.meta.key);
        if (rankDiff) return rankDiff;
        return Number(left.items[0]?.sortOrder || 0) - Number(right.items[0]?.sortOrder || 0);
      })
      .map((group) => `${categoryHeading(group.meta.title)}${group.meta.banner ? categoryBanner(group.meta.banner) : ""}${group.items.map(productCard).join("")}`)
      .join("");
    grid.innerHTML = markup;
    grid.querySelectorAll("[data-product-image]").forEach((element) => {
      setImage(element, element.dataset.productImage);
      const product = products.get(element.dataset.productImageSlug);
      if (product) element.style.setProperty("--card-pos", cardImagePosition(product));
    });
    state.cart = state.cart.filter((item) => products.has(item.slug));
    saveCart();
    renderCart();
  }

  function renderFacts(product) {
    const facts = [
      product.priceOptions?.length && ["Фасовки", product.priceOptions.map(formatPriceOption).join("; ")],
      product.dosage && ["Дозировка", product.dosage],
      product.composition && ["Состав", product.composition],
      product.notice && ["Важно", product.notice]
    ].filter(Boolean);
    modalEls.facts.innerHTML = facts.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("");
    modalEls.facts.hidden = !facts.length;
  }

  function renderBenefits(product) {
    if (!product.benefits?.length) return "";
    const firstBenefit = product.benefits[0] || "";
    if (firstBenefit && String(product.description || "").includes(firstBenefit)) return "";
    return `<ul>${product.benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function modalDescription(product) {
    const source = product.description || product.shortDescription || "";
    return source.split(/\n+/).map((line) => line.trim()).filter((line) => line && !/^(Рекомендованная дозировка|Состав|Не является)/i.test(line)).join("\n\n");
  }

  function renderModalVariant(product) {
    let row = modal.querySelector("[data-product-modal-variant-row]");
    if (!row) {
      row = document.createElement("label");
      row.className = "product-modal__variant";
      row.dataset.productModalVariantRow = "";
      row.innerHTML = `<span>Фасовка</span><select data-product-modal-variant></select>`;
      modalEls.facts.insertAdjacentElement("afterend", row);
    }
    const select = row.querySelector("select");
    select.innerHTML = priceOptions(product).map((option) => `<option value="${escapeHtml(option.unit)}">${escapeHtml(formatPriceOption(option))}</option>`).join("");
    row.hidden = priceOptions(product).length <= 1;
  }

  function openProduct(slug) {
    const product = products.get(slug);
    if (!product) return;
    setModalImage(product);
    modalEls.title.textContent = product.title;
    modalEls.meta.textContent = [product.category, formatProductUnits(product)].filter(Boolean).join(" ? ");
    modalEls.price.innerHTML = modalPriceMarkup(product);
    modalEls.description.innerHTML = `${escapeHtml(modalDescription(product)).replace(/\n/g, "<br>")}${renderBenefits(product)}`;
    delete modalEls.order.dataset.cartAddModal;
    delete modalEls.order.dataset.whatsappProduct;
    modalEls.order.removeAttribute("href");
    modalEls.order.removeAttribute("target");
    modalEls.order.removeAttribute("rel");
    if (!canCheckoutProduct(product)) {
      modalEls.order.textContent = "Купить";
      modalEls.order.href = whatsappUrl(product, firstOption(product)?.unit);
      modalEls.order.target = "_blank";
      modalEls.order.rel = "noopener";
      modalEls.order.dataset.whatsappProduct = product.slug;
    } else {
      modalEls.order.textContent = "Добавить в корзину";
      modalEls.order.dataset.cartAddModal = product.slug;
    }
    renderFacts(product);
    renderModalVariant(product);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    if (cartEls.panel.hidden) document.body.style.overflow = "";
  }

  function renderCart() {
    const nextCart = state.cart.filter(canCheckoutCartItem);
    if (nextCart.length !== state.cart.length) {
      state.cart = nextCart;
      handleCartChanged();
      saveCart();
    }
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    cartEls.fab.hidden = !canUseCheckoutPayment();
    cartEls.count.textContent = count;
    cartEls.fab.setAttribute("aria-label", count ? `Открыть корзину, товаров: ${count}` : "Открыть корзину");
    cartEls.root.classList.toggle("has-items", count > 0);
    if (!state.cart.length) {
      cartEls.list.innerHTML = '<p class="cart-empty">Корзина пока пустая.</p>';
      cartEls.form.hidden = true;
      clearPromoState({ keepCode: false, message: "" });
      renderPromoState();
      renderSummary();
      return;
    }
    cartEls.form.hidden = false;
    cartEls.list.innerHTML = state.cart.map((item) => `
      <article class="cart-item">
        <span class="cart-item__image" style="--image: url('${escapeHtml(safeImageUrl(item.imageUrl))}')"></span>
        <span class="cart-item__info"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.unit)} · ${money(item.price)}</small></span>
        <span class="cart-item__qty"><button type="button" data-cart-dec="${escapeHtml(item.key)}">−</button><b>${item.quantity}</b><button type="button" data-cart-inc="${escapeHtml(item.key)}">+</button></span>
        <strong class="cart-item__sum">${money(item.price * item.quantity)}</strong>
        <button class="cart-item__remove" type="button" data-cart-remove="${escapeHtml(item.key)}" aria-label="Убрать товар">×</button>
      </article>`).join("");
    cartEls.deliverySection.hidden = !(state.settings.deliveryEnabled && state.settings.cdekReady);
    const submit = cartEls.form.querySelector(".checkout-submit");
    const paymentReady = canUseCheckoutPayment();
    submit.disabled = !paymentReady;
    submit.textContent = paymentReady ? "Перейти к оплате" : "Оплата скоро будет доступна";
    showCheckoutError(paymentReady ? "" : "ЮКасса появится после подключения ключей на сервере.");
    renderPromoState();
    renderSummary();
  }

  function renderSummary() {
    const totals = cartTotals();
    const promoLine = totals.discountAmount > 0
      ? `<div><span>Промокод ${escapeHtml(state.promo.applied?.code || state.promo.code || "")}</span><strong>−${money(totals.discountAmount)}</strong></div>`
      : "";
    const deliveryLine = state.settings.deliveryEnabled && state.settings.cdekReady
      ? `<span>Доставка CDEK</span><strong>${state.checkout.delivery ? money(totals.deliveryPrice) : "нужно выбрать ПВЗ"}</strong>`
      : `<span>Доставка</span><strong>${state.settings.deliveryEnabled ? "требует настройки" : "отключена"}</strong>`;
    cartEls.summary.innerHTML = `<div><span>Товары</span><strong>${money(totals.subtotal)}</strong></div>${promoLine}<div>${deliveryLine}</div><div class="cart-summary__total"><span>Итого</span><strong>${money(totals.total)}</strong></div>`;
    cartEls.deliveryNote.textContent = state.checkout.delivery
      ? `CDEK: ${money(state.checkout.delivery.price)}${state.checkout.delivery.periodMin ? `, ${state.checkout.delivery.periodMin}-${state.checkout.delivery.periodMax || state.checkout.delivery.periodMin} дн.` : ""}`
      : "Стоимость доставки рассчитается после выбора пункта выдачи.";
  }

  function showCheckoutError(message) {
    cartEls.error.textContent = message;
    cartEls.error.hidden = !message;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", headers: options.body ? { "Content-Type": "application/json" } : {}, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Ошибка запроса.");
    return data;
  }

  let cityTimer = null;
  function scheduleCitySearch() {
    window.clearTimeout(cityTimer);
    cityTimer = window.setTimeout(searchCities, 320);
  }

  async function searchCities() {
    const query = cartEls.cityInput.value.trim();
    state.checkout.city = null;
    state.checkout.selectedPoint = null;
    state.checkout.delivery = null;
    cartEls.pointSelect.disabled = true;
    cartEls.pointSelect.innerHTML = '<option value="">Сначала выберите город</option>';
    if (query.length < 2 || !state.settings.cdekSearchReady) {
      cartEls.cityOptions.innerHTML = "";
      renderSummary();
      return;
    }
    try {
      const data = await fetchJson(`/chat-api/delivery/cities?q=${encodeURIComponent(query)}`);
      cartEls.cityOptions.innerHTML = (data.cities || []).map((city) => `<button type="button" data-city-code="${city.code}" data-city-name="${escapeHtml(city.name)}" data-city-region="${escapeHtml(city.region || "")}">${escapeHtml(city.name)}${city.region ? `, ${escapeHtml(city.region)}` : ""}</button>`).join("");
    } catch (error) {
      showCheckoutError(error.message);
    }
  }

  async function selectCity(city) {
    state.checkout.city = city;
    state.checkout.selectedPoint = null;
    state.checkout.delivery = null;
    cartEls.cityInput.value = city.region ? `${city.name}, ${city.region}` : city.name;
    cartEls.cityOptions.innerHTML = "";
    cartEls.pointSelect.disabled = true;
    cartEls.pointSelect.innerHTML = '<option value="">Загрузка пунктов...</option>';
    try {
      const data = await fetchJson(`/chat-api/delivery/points?cityCode=${encodeURIComponent(city.code)}`);
      state.checkout.points = data.points || [];
      cartEls.pointSelect.disabled = !state.checkout.points.length;
      cartEls.pointSelect.innerHTML = '<option value="">Выберите пункт выдачи</option>' + state.checkout.points.map((point) => `<option value="${escapeHtml(point.code)}">${escapeHtml(point.name)} · ${escapeHtml(point.address)}</option>`).join("");
      renderSummary();
    } catch (error) {
      cartEls.pointSelect.innerHTML = '<option value="">Не удалось загрузить пункты</option>';
      showCheckoutError(error.message);
    }
  }

  async function calculateDelivery() {
    const code = cartEls.pointSelect.value;
    const point = state.checkout.points.find((item) => item.code === code);
    state.checkout.selectedPoint = point || null;
    state.checkout.delivery = null;
    if (!state.checkout.city || !point) {
      renderSummary();
      return;
    }
    try {
      const data = await fetchJson("/chat-api/delivery/calculate", { method: "POST", body: JSON.stringify({ cityCode: state.checkout.city.code, deliveryPointCode: point.code, items: cartPayload() }) });
      state.checkout.delivery = data.delivery;
      renderSummary();
    } catch (error) {
      showCheckoutError(error.message);
      renderSummary();
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    showCheckoutError("");
    if (!state.cart.length) return;
    if (state.settings.deliveryEnabled && state.settings.cdekReady && (!state.checkout.city || !state.checkout.selectedPoint || !state.checkout.delivery)) {
      showCheckoutError("Выберите город и пункт выдачи CDEK.");
      return;
    }
    const form = new FormData(cartEls.form);
    const delivery = state.settings.deliveryEnabled && state.settings.cdekReady ? {
      cityCode: state.checkout.city.code,
      cityName: state.checkout.city.name,
      deliveryPointCode: state.checkout.selectedPoint.code,
      pointName: state.checkout.selectedPoint.name,
      pointAddress: state.checkout.selectedPoint.address
    } : null;
    const submit = cartEls.form.querySelector(".checkout-submit");
    if (!canUseCheckoutPayment()) {
      showCheckoutError("ЮКасса появится после подключения ключей на сервере.");
      return;
    }
    if (!String(form.get("email") || "").trim()) {
      showCheckoutError("Укажите email для отправки чека ЮКассы.");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Создаём заказ...";
    try {
      const promoCode = normalizedPromoCode(form.get("promoCode"));
      if (promoCode && normalizedPromoCode(state.promo.applied?.code) !== promoCode) {
        const ok = await syncPromoState();
        if (!ok) {
          showCheckoutError(state.promo.message || "Промокод не удалось применить.");
          return;
        }
      }
      const data = await fetchJson("/chat-api/orders", { method: "POST", body: JSON.stringify({ customer: { name: form.get("name"), phone: form.get("phone"), email: form.get("email"), comment: form.get("comment") }, delivery, items: cartPayload(), promoCode }) });
      if (data.paymentUrl) {
        state.cart = [];
        saveCart();
        window.location.href = data.paymentUrl;
        return;
      }
      showCheckoutError("Заказ создан, но ссылка на оплату не получена. Проверьте настройки ЮКассы.");
    } catch (error) {
      if (error.message === "YooKassa is not configured.") {
        showCheckoutError("ЮКасса пока не настроена: пропишите ключи на сервере.");
      } else if (error.message.startsWith("YooKassa payment error:")) {
        showCheckoutError("ЮКасса отклонила shopID или secret key. Проверьте ключи в личном кабинете ЮКассы.");
      } else {
        showCheckoutError(error.message);
      }
    } finally {
      submit.disabled = false;
      submit.textContent = "Перейти к оплате";
    }
  }

  grid.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-cart-add]");
    if (addButton) {
      event.preventDefault();
      const product = products.get(addButton.dataset.cartAdd);
      if (!product || !canCheckoutProduct(product, addButton.dataset.cartUnit)) {
        if (product) window.open(whatsappUrl(product, addButton.dataset.cartUnit), "_blank", "noopener");
        return;
      }
      addToCart(addButton.dataset.cartAdd, addButton.dataset.cartUnit);
      return;
    }
    const opener = event.target.closest("[data-product-detail], [data-product-open]");
    if (opener) openProduct(opener.dataset.productDetail || opener.dataset.productOpen);
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const opener = event.target.closest("[data-product-open]");
    if (opener) {
      event.preventDefault();
      openProduct(opener.dataset.productOpen);
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-product-close]")) {
      closeModal();
      return;
    }
    const whatsapp = event.target.closest("[data-whatsapp-product]");
    if (whatsapp) {
      const product = products.get(whatsapp.dataset.whatsappProduct);
      const select = modal.querySelector("[data-product-modal-variant]");
      if (product) whatsapp.href = whatsappUrl(product, select?.value || firstOption(product)?.unit);
      return;
    }
    const modalAdd = event.target.closest("[data-cart-add-modal]");
    if (modalAdd) {
      event.preventDefault();
      const select = modal.querySelector("[data-product-modal-variant]");
      addToCart(modalAdd.dataset.cartAddModal, select?.value || "");
      closeModal();
    }
  });

  cartEls.root.addEventListener("click", (event) => {
    if (event.target.closest("[data-cart-open]")) openCart();
    if (event.target.closest("[data-cart-close]")) closeCart();
    const inc = event.target.closest("[data-cart-inc]");
    const dec = event.target.closest("[data-cart-dec]");
    const remove = event.target.closest("[data-cart-remove]");
    if (inc) {
      const item = state.cart.find((entry) => entry.key === inc.dataset.cartInc);
      if (item) setCartQuantity(item.key, item.quantity + 1);
    }
    if (dec) {
      const item = state.cart.find((entry) => entry.key === dec.dataset.cartDec);
      if (item) setCartQuantity(item.key, item.quantity - 1);
    }
    if (remove) removeCartItem(remove.dataset.cartRemove);
  });

  cartEls.cityInput.addEventListener("input", scheduleCitySearch);
  cartEls.promoInput.addEventListener("input", () => {
    const code = normalizedPromoCode(cartEls.promoInput.value);
    state.promo.code = code;
    if (!code) {
      clearPromoState({ keepCode: true, message: "Введите промокод, чтобы пересчитать итог заказа." });
    } else if (normalizedPromoCode(state.promo.applied?.code) !== code) {
      clearPromoState({ keepCode: true, message: "Нажмите «Применить», чтобы проверить промокод." });
    }
    renderPromoState();
    renderSummary();
  });
  cartEls.promoApplyButton.addEventListener("click", async () => {
    if (!state.cart.length) return;
    if (!normalizedPromoCode(cartEls.promoInput.value)) {
      clearPromoState({ keepCode: true, message: "Введите промокод.", isError: true });
      renderPromoState();
      renderSummary();
      return;
    }
    await syncPromoState();
  });
  cartEls.cityOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-city-code]");
    if (!button) return;
    selectCity({ code: button.dataset.cityCode, name: button.dataset.cityName, region: button.dataset.cityRegion });
  });
  cartEls.pointSelect.addEventListener("change", calculateDelivery);
  cartEls.form.addEventListener("submit", submitOrder);

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[aria-label="Корзина"]');
    if (link) {
      event.preventDefault();
      openCart();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!modal.hidden) closeModal();
      if (!cartEls.panel.hidden) closeCart();
    }
  });

  Promise.all([
    fetch("/chat-api/store/settings", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : {}),
    fetch("/chat-api/products", { credentials: "same-origin" }).then((response) => {
      if (!response.ok) throw new Error("Catalog unavailable");
      return response.json();
    })
  ])
    .then(([settings, data]) => {
      state.settings = { ...state.settings, ...settings };
      if (!state.settings.cdekSearchReady) cartEls.deliveryNote.textContent = "CDEK появится после настройки ключей.";
      if (state.settings.cdekSearchReady && !state.settings.cdekReady) cartEls.deliveryNote.textContent = "Укажите город отправления CDEK в админке.";
      renderProducts(data.products || []);
    })
    .catch(() => {
      renderCart();
      grid.querySelectorAll(".product-card__image").forEach((element) => {
        const match = String(element.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/);
        if (match) setImage(element, match[1]);
      });
    });
})();
