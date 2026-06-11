(() => {
  const grid = document.querySelector("[data-product-grid]");
  const modal = document.querySelector("[data-product-modal]");
  if (!grid || !modal) {
    return;
  }

  const products = new Map();
  const fallbackImage = "/images/product-reishi.png";
  const phone = "79871355371";

  const modalEls = {
    image: modal.querySelector("[data-product-modal-image]"),
    title: modal.querySelector("[data-product-modal-title]"),
    meta: modal.querySelector("[data-product-modal-meta]"),
    description: modal.querySelector("[data-product-modal-description]"),
    facts: modal.querySelector("[data-product-modal-facts]"),
    order: modal.querySelector("[data-product-modal-order]")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (/^(\/images\/|images\/|https?:\/\/)/i.test(url)) {
      return url;
    }
    return fallbackImage;
  }

  function setImage(element, imageUrl) {
    element.style.setProperty("--image", `url("${safeImageUrl(imageUrl).replace(/"/g, "%22")}")`);
  }

  function modalImagePosition(product) {
    const slug = String(product.slug || "").toLowerCase();
    if (slug.includes("шиитаке")) {
      return "64% center";
    }
    if (slug.includes("мейтаке")) {
      return "61% center";
    }
    if (slug.includes("ежовика")) {
      return "54% center";
    }
    if (slug.includes("кордицепса")) {
      return "48% center";
    }
    return "52% center";
  }

  function cardImagePosition(product) {
    const slug = String(product.slug || "").toLowerCase();
    if (slug.includes("шиитаке")) {
      return "66% center";
    }
    if (slug.includes("мейтаке")) {
      return "63% center";
    }
    if (slug.includes("ежовика")) {
      return "55% center";
    }
    if (slug.includes("кордицепса")) {
      return "48% center";
    }
    if (slug.includes("рейши")) {
      return "53% center";
    }
    if (slug.includes("траметеса")) {
      return "52% center";
    }
    return "center";
  }

  function setModalImage(product) {
    setImage(modalEls.image, product.imageUrl);
    modalEls.image.style.setProperty("--modal-pos", modalImagePosition(product));
    modalEls.image.style.setProperty("--modal-size", "auto 96%");
  }

  function formatPrice(product) {
    if (product.priceOptions?.length) {
      return `от ${Number(product.priceOptions[0].price).toLocaleString("ru-RU")} ₽`;
    }
    if (!Number(product.price)) {
      return "По запросу";
    }
    return `${Number(product.price).toLocaleString("ru-RU")} ₽`;
  }

  function formatPriceOption(option) {
    return `${option.unit} - ${Number(option.price).toLocaleString("ru-RU")} ₽`;
  }

  function formatProductUnits(product) {
    if (product.priceOptions?.length) {
      return product.priceOptions.map((option) => option.unit).join(" / ");
    }
    return product.unit || product.subtitle || "";
  }

  function renderCardPrices(product) {
    if (!product.priceOptions?.length) {
      return "";
    }
    return `
      <div class="product-card__prices" data-product-open="${escapeHtml(product.slug)}" role="button" tabindex="0">
        ${product.priceOptions.map((option) => `<span>${escapeHtml(formatPriceOption(option))}</span>`).join("")}
      </div>
    `;
  }

  function whatsappUrl(product) {
    const text = `Здравствуйте, хочу узнать о товаре: ${product.title}.`;
    return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
  }

  function productCard(product) {
    const description = product.shortDescription || product.description || product.composition || "";
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
            <span class="price">${escapeHtml(formatPrice(product))}</span>
            <a class="cart-button" href="${escapeHtml(whatsappUrl(product))}" target="_blank" rel="noopener" aria-label="Заказать ${escapeHtml(product.title)}">
              <svg class="icon"><use href="#icon-cart"></use></svg>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderProducts(items) {
    if (!items.length) {
      grid.innerHTML = '<p class="product-card__empty">Каталог скоро появится.</p>';
      return;
    }

    products.clear();
    for (const product of items) {
      products.set(product.slug, product);
    }
    grid.innerHTML = items.map(productCard).join("");
    grid.querySelectorAll("[data-product-image]").forEach((element) => {
      setImage(element, element.dataset.productImage);
      const product = products.get(element.dataset.productImageSlug);
      if (product) {
        element.style.setProperty("--card-pos", cardImagePosition(product));
      }
    });
  }

  function renderFacts(product) {
    const facts = [
      product.priceOptions?.length && ["Фасовки", product.priceOptions.map(formatPriceOption).join("; ")],
      product.dosage && ["Дозировка", product.dosage],
      product.composition && ["Состав", product.composition],
      product.notice && ["Важно", product.notice]
    ].filter(Boolean);

    modalEls.facts.innerHTML = facts.map(([label, value]) => (
      `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    )).join("");
    modalEls.facts.hidden = !facts.length;
  }

  function renderBenefits(product) {
    if (!product.benefits?.length) {
      return "";
    }
    const firstBenefit = product.benefits[0] || "";
    if (firstBenefit && String(product.description || "").includes(firstBenefit)) {
      return "";
    }
    return `<ul>${product.benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function modalDescription(product) {
    const source = product.description || product.shortDescription || "";
    return source
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) {
          return false;
        }
        return !/^(Рекомендованная дозировка|Состав|Не является)/i.test(line);
      })
      .join("\n\n");
  }

  function openProduct(slug) {
    const product = products.get(slug);
    if (!product) {
      return;
    }

    setModalImage(product);
    modalEls.title.textContent = product.title;
    modalEls.meta.textContent = [product.category, formatProductUnits(product), formatPrice(product)].filter(Boolean).join(" · ");
    modalEls.description.innerHTML = `${escapeHtml(modalDescription(product)).replace(/\n/g, "<br>")}${renderBenefits(product)}`;
    modalEls.order.href = whatsappUrl(product);
    renderFacts(product);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  grid.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-product-detail], [data-product-open]");
    if (opener) {
      openProduct(opener.dataset.productDetail || opener.dataset.productOpen);
    }
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const opener = event.target.closest("[data-product-open]");
    if (opener) {
      event.preventDefault();
      openProduct(opener.dataset.productOpen);
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-product-close]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  fetch("/chat-api/products", { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Catalog unavailable");
      }
      return response.json();
    })
    .then((data) => renderProducts(data.products || []))
    .catch(() => {
      grid.querySelectorAll(".product-card__image").forEach((element) => {
        const match = String(element.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/);
        if (match) {
          setImage(element, match[1]);
        }
      });
    });
})();
