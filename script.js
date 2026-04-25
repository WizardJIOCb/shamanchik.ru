const revealItems = document.querySelectorAll(".reveal");
const whatsappPhone = "79871355371";
const footer = document.querySelector(".footer");

if (footer) {
  footer.innerHTML = `
    <p>&copy; 2026 Шаманчик</p>
    <nav class="footer__links" aria-label="Документы и контакты">
      <a href="/payment.html">Оплата и тарифы</a>
      <a href="/offer.html">Оферта</a>
      <a href="/contacts.html">Контакты и реквизиты</a>
      <a href="${window.location.pathname === "/" ? "#top" : "/"}">${window.location.pathname === "/" ? "Наверх" : "Главная"}</a>
    </nav>
  `;
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.16,
});

revealItems.forEach((item) => {
  revealObserver.observe(item);
});

const buildWhatsappLink = (text) => {
  const params = new URLSearchParams({
    phone: whatsappPhone,
    text,
    type: "phone_number",
    app_absent: "0",
  });

  return `https://api.whatsapp.com/send/?${params.toString()}`;
};

const openWhatsapp = (text) => {
  window.open(buildWhatsappLink(text), "_blank", "noopener,noreferrer");
};

document.querySelectorAll(".product-card").forEach((card) => {
  const productName = card.dataset.product || "товар";

  card.addEventListener("click", () => {
    openWhatsapp(`Здравствуйте, хочу приобрести ${productName}.`);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openWhatsapp(`Здравствуйте, хочу приобрести ${productName}.`);
    }
  });
});
