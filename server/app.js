const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const webPush = require("web-push");
const { DatabaseSync } = require("node:sqlite");
const { WebSocketServer, WebSocket } = require("ws");
const { registerArticlesModule } = require("./articles");

const ROOT_DIR = path.resolve(__dirname, "..");
const CHAT_DIR = path.join(ROOT_DIR, "chat");
const STATIC_PAGES = new Map([
  ["/", "index.html"],
  ["/profile", "profile.html"],
  ["/profile.html", "profile.html"],
  ["/payment", "payment.html"],
  ["/payment.html", "payment.html"],
  ["/offer", "offer.html"],
  ["/offer.html", "offer.html"],
  ["/contacts", "contacts.html"],
  ["/contacts.html", "contacts.html"]
]);
const STORAGE_DIR = process.env.CHAT_STORAGE_DIR || path.join(ROOT_DIR, "storage");
const DB_PATH = process.env.CHAT_DB_PATH || path.join(STORAGE_DIR, "chat.sqlite");
const UPLOAD_DIR = process.env.CHAT_UPLOAD_DIR || path.join(STORAGE_DIR, "uploads");
const PRODUCT_ASSETS_DIR = path.join(ROOT_DIR, "images", "products");
const PRODUCT_UPLOAD_DIR = process.env.CHAT_PRODUCT_UPLOAD_DIR || path.join(STORAGE_DIR, "product-images");
const PROFILE_AVATAR_PREFIX = "/chat-uploads/";
const PRODUCTS_MD_PATH = path.join(PRODUCT_ASSETS_DIR, "products.md");
const PORT = Number(process.env.PORT || 3210);
const SESSION_COOKIE = "shamanchik_chat_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const REACTION_OPTIONS = ["🍄", "🌿", "🔥", "😀", "😌", "😍", "😎", "😂", "😇", "🤝"];
const ADMIN_USERNAMES = new Set([
  "wizardjiocb",
  "shamanchik008",
  "shamanchik007"
]);
const GRAIN_MYCELIUM_PRICE_OPTIONS = [
  { unit: "100 г", price: 800, packageLength: 20, packageWidth: 15, packageHeight: 10 },
  { unit: "300 г", price: 2200, packageLength: 60, packageWidth: 45, packageHeight: 30 },
  { unit: "500 г", price: 3500, packageLength: 100, packageWidth: 75, packageHeight: 50 },
  { unit: "1000 г", price: 6000, packageLength: 200, packageWidth: 150, packageHeight: 100 }
];
const DEFAULT_CATEGORY_BANNERS = [
  { title: "Сома", category: "Сома", imageUrl: "/images/banner1.jpg", altText: "Баннер категории Сома", sortOrder: 20 },
  { title: "Плодовые тела", category: "Плодовые тела", imageUrl: "/images/5292189051106566349.jpg", altText: "Баннер категории Плодовые тела", sortOrder: 30 },
  { title: "Грибные мази", category: "Мази", imageUrl: "/images/5292189051106566348.jpg", altText: "Баннер категории Мази", sortOrder: 40 },
  { title: "Сыродавленные масла", category: "Масла", imageUrl: "/images/5292189051106566347.jpg", altText: "Баннер категории Масла", sortOrder: 50 },
  { title: "Масла, пасты и мёд", category: "Масла, пасты и мёд", imageUrl: "/images/banner3.jpg", altText: "Баннер медовой продукции", sortOrder: 60 },
  { title: "Медовая продукция", category: "Медовая продукция", imageUrl: "/images/banner3.jpg", altText: "Баннер медовой продукции", sortOrder: 70 }
];
const CDEK_BASE_URL = process.env.CDEK_BASE_URL || "https://api.cdek.ru/v2";
const CDEK_ACCOUNT = process.env.CDEK_ACCOUNT || process.env.CDEK_CLIENT_ID || "";
const CDEK_SECURE_PASSWORD = process.env.CDEK_SECURE_PASSWORD || process.env.CDEK_CLIENT_SECRET || "";
const CDEK_SENDER_POINT_CODE = process.env.CDEK_SENDER_POINT_CODE || "";
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";
const YOOKASSA_API_URL = process.env.YOOKASSA_API_URL || "https://api.yookassa.ru/v3";
const SITE_URL = (process.env.SITE_URL || "https://shamanchik.ru").replace(/\/$/, "");
const generatedVapidKeys = (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
  ? webPush.generateVAPIDKeys()
  : null;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || generatedVapidKeys.publicKey;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || generatedVapidKeys.privateKey;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || `mailto:admin@${new URL(SITE_URL).hostname}`;
const DEFAULT_CDEK_TARIFF_CODE = 136;
const DEFAULT_PACKAGE = { length: 20, width: 15, height: 10 };
const CURATED_CATALOG_PRODUCTS = [
  {
    slug: "pasta-shamana",
    title: "Паста Шамана",
    subtitle: "",
    category: "Масла, пасты и мёд",
    shortDescription: "Паста Шамана создана на основе классической пасты Амосова и дополнена шестью видами зернового мицелия грибов.",
    description: `Паста Шамана

Паста Шамана создана на основе классической пасты Амосова и дополнена шестью видами зернового мицелия грибов: ежовиком гребенчатым, рейши, кордицепсом милитарис, шиитаке, мейтаке и траметесом разноцветным.
Сочетание башкирского мёда, орехов, сухофруктов и грибного мицелия делает продукт источником природных сахаров, пищевых волокон, аминокислот, полисахаридов, витаминов и микроэлементов.

Паста Шамана традиционно используется для:
• Поддержания общего жизненного тонуса
• Поддержания энергии и работоспособности
• Поддержания иммунной системы
• Поддержания концентрации внимания и продуктивности
• Поддержания восстановительных процессов организма
• Дополнения ежедневного рациона природными питательными веществами

Многие ценители грибных традиций выбирают пасту как удобный способ сочетать продукты пчеловодства, орехи, сухофрукты и грибной мицелий в одном продукте.

Состав:
Башкирский мёд донник, орехи, сухофрукты, зерновой мицелий ежовика гребенчатого, рейши, кордицепса милитарис, шиитаке, мейтаке и траметеса разноцветного.

Рекомендуемая дозировка:
1–2 чайные ложки в день.

Не является лекарственным средством.`,
    benefits: [
      "Поддержания общего жизненного тонуса",
      "Поддержания энергии и работоспособности",
      "Поддержания иммунной системы",
      "Поддержания концентрации внимания и продуктивности",
      "Поддержания восстановительных процессов организма",
      "Дополнения ежедневного рациона природными питательными веществами"
    ],
    dosage: "1–2 чайные ложки в день.",
    composition: "Башкирский мёд донник, орехи, сухофрукты, зерновой мицелий ежовика гребенчатого, рейши, кордицепса милитарис, шиитаке, мейтаке и траметеса разноцветного.",
    notice: "Не является лекарственным средством.",
    imageUrl: "/images/products/5285301568536256280.jpg",
    price: 0,
    unit: "Фасовка уточняется",
    sortOrder: 20
  },
  {
    slug: "bashkirskiy-med-donnik",
    title: "Башкирский мёд Донник",
    subtitle: "",
    category: "Масла, пасты и мёд",
    shortDescription: "Башкирский мёд Донник — натуральный продукт пчеловодства, собранный с цветков донника, с мягким вкусом и богатым природным составом.",
    description: `Башкирский мёд Донник

Башкирский мёд Донник - натуральный продукт пчеловодства, собранный с цветков донника. Ценится за мягкий вкус, характерный аромат и богатый природный состав.
Мёд содержит природные сахара, ферменты, органические кислоты, аминокислоты, антиоксиданты, витамины и микроэлементы, благодаря чему на протяжении многих поколений занимает особое место в традициях питания.

Башкирский мёд Донник традиционно используется для:
• Поддержания общего жизненного тонуса
• Восполнения энергии и жизненных ресурсов
• Поддержания активного образа жизни
• Поддержания восстановительных процессов организма
• Дополнения ежедневного рациона природными питательными веществами
• Поддержания общего хорошего самочувствия

Многие ценители натуральных продуктов выбирают донниковый мёд за его мягкий вкус, насыщенный состав и удобство ежедневного использования.

Состав:
Натуральный башкирский мёд Донник.

Рекомендуемая дозировка:
По индивидуальным предпочтениям.

Не является лекарственным средством.`,
    benefits: [
      "Поддержания общего жизненного тонуса",
      "Восполнения энергии и жизненных ресурсов",
      "Поддержания активного образа жизни",
      "Поддержания восстановительных процессов организма",
      "Дополнения ежедневного рациона природными питательными веществами",
      "Поддержания общего хорошего самочувствия"
    ],
    dosage: "По индивидуальным предпочтениям.",
    composition: "Натуральный башкирский мёд Донник.",
    notice: "Не является лекарственным средством.",
    imageUrl: "/images/products/5285301568536256295.jpg",
    price: 0,
    unit: "Фасовка уточняется",
    sortOrder: 21
  },
  {
    slug: "maslo-macis-premium",
    title: "Масло мацис премиум (Шри-Ланка)",
    subtitle: "",
    category: "Масла, пасты и мёд",
    shortDescription: "Масло мацис премиум производится из оболочки мускатного ореха со Шри-Ланки и сохраняет природный состав благодаря холодному отжиму.",
    description: `Масло мацис премиум (Шри-Ланка)

Масло мацис премиум производится из оболочки мускатного ореха, выращенного на территории Шри-Ланки - региона, который на протяжении многих веков славится своими специями высокого качества. Бережный метод холодного отжима позволяет сохранить природный состав и ароматические свойства сырья.
Масло содержит природные эфирные соединения, антиоксиданты и другие биологически активные вещества, благодаря чему высоко ценится среди сторонников натуральных продуктов и традиционных оздоровительных практик.

Масло мацис традиционно используется для:
• Поддержания общего жизненного тонуса
• Поддержания внутреннего спокойствия и эмоционального равновесия
• Поддержания концентрации внимания и ясности мышления
• Поддержания гармоничного психоэмоционального состояния
• Поддержания активного образа жизни
• Дополнения ежедневного рациона природными биологически активными веществами

Многие ценители натуральных продуктов отмечают насыщенный аромат, высокое качество шри-ланкийского сырья и удобство ежедневного использования масла мацис.

Состав:
100% сыродавленное масло мацис (Шри-Ланка)

Рекомендуемая дозировка:
0,3 мл в день (1/3 пипетки).

Не является лекарственным средством.`,
    benefits: [
      "Поддержания общего жизненного тонуса",
      "Поддержания внутреннего спокойствия и эмоционального равновесия",
      "Поддержания концентрации внимания и ясности мышления",
      "Поддержания гармоничного психоэмоционального состояния",
      "Поддержания активного образа жизни",
      "Дополнения ежедневного рациона природными биологически активными веществами"
    ],
    dosage: "0,3 мл в день (1/3 пипетки).",
    composition: "100% сыродавленное масло мацис (Шри-Ланка)",
    notice: "Не является лекарственным средством.",
    imageUrl: "/images/products/5285138462858224203.jpg",
    price: 0,
    unit: "Фасовка уточняется",
    sortOrder: 22
  }
];


function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

ensureDirectory(STORAGE_DIR);
ensureDirectory(UPLOAD_DIR);
ensureDirectory(PRODUCT_UPLOAD_DIR);
ensureDirectory(PRODUCT_ASSETS_DIR);

const db = new DatabaseSync(DB_PATH);
webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
if (generatedVapidKeys) {
  console.warn("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set. Generated temporary Web Push keys for this process.");
}

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'public',
    owner_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS channel_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL,
    UNIQUE(channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS channel_visits (
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    visits_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS channel_daily_activity (
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    activity_date TEXT NOT NULL,
    PRIMARY KEY(channel_id, user_id, activity_date),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_size INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(message_id, user_id, emoji),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    short_description TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    benefits_json TEXT NOT NULL DEFAULT '[]',
    dosage TEXT NOT NULL DEFAULT '',
    composition TEXT NOT NULL DEFAULT '',
    notice TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    discount_percent INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '100 г',
    price_options_json TEXT NOT NULL DEFAULT '[]',
    package_length INTEGER NOT NULL DEFAULT 20,
    package_width INTEGER NOT NULL DEFAULT 15,
    package_height INTEGER NOT NULL DEFAULT 10,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS category_banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    category_key TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL DEFAULT '',
    alt_text TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    public_id TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    customer_comment TEXT NOT NULL DEFAULT '',
    items_json TEXT NOT NULL,
    delivery_json TEXT NOT NULL DEFAULT '{}',
    subtotal INTEGER NOT NULL DEFAULT 0,
    delivery_price INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    payment_provider TEXT NOT NULL DEFAULT 'yookassa',
    payment_id TEXT NOT NULL DEFAULT '',
    payment_url TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT '',
    promo_code TEXT NOT NULL DEFAULT '',
    promo_discount_amount INTEGER NOT NULL DEFAULT 0,
    promo_details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    discount_kind TEXT NOT NULL DEFAULT 'percent',
    discount_value INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT NOT NULL DEFAULT '',
    ends_at TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

`);

function ensureUserSchema() {
  const columns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
  if (!columns.includes("avatar_url")) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }
}

function ensureProductSchema() {
  const columns = db.prepare("PRAGMA table_info(products)").all().map((column) => column.name);
  if (!columns.includes("price_options_json")) {
    db.exec("ALTER TABLE products ADD COLUMN price_options_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.includes("discount_percent")) {
    db.exec("ALTER TABLE products ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.includes("package_length")) {
    db.exec(`ALTER TABLE products ADD COLUMN package_length INTEGER NOT NULL DEFAULT ${DEFAULT_PACKAGE.length}`);
  }
  if (!columns.includes("package_width")) {
    db.exec(`ALTER TABLE products ADD COLUMN package_width INTEGER NOT NULL DEFAULT ${DEFAULT_PACKAGE.width}`);
  }
  if (!columns.includes("package_height")) {
    db.exec(`ALTER TABLE products ADD COLUMN package_height INTEGER NOT NULL DEFAULT ${DEFAULT_PACKAGE.height}`);
  }
}

function ensureOrderSchema() {
  const columns = db.prepare("PRAGMA table_info(orders)").all().map((column) => column.name);
  if (!columns.includes("user_id")) {
    db.exec("ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
  }
  if (!columns.includes("promo_code")) {
    db.exec("ALTER TABLE orders ADD COLUMN promo_code TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.includes("promo_discount_amount")) {
    db.exec("ALTER TABLE orders ADD COLUMN promo_discount_amount INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.includes("promo_details_json")) {
    db.exec("ALTER TABLE orders ADD COLUMN promo_details_json TEXT NOT NULL DEFAULT '{}'");
  }
}

ensureUserSchema();
ensureProductSchema();
ensureOrderSchema();
function ensureStoreSettings() {
  const defaults = new Map([
    ["delivery_enabled", process.env.CDEK_FROM_LOCATION_CODE ? "1" : "0"],
    ["cdek_from_location_code", process.env.CDEK_FROM_LOCATION_CODE || ""],
    ["cdek_sender_point_code", CDEK_SENDER_POINT_CODE],
    ["cdek_tariff_code", String(process.env.CDEK_TARIFF_CODE || DEFAULT_CDEK_TARIFF_CODE)],
    ["cdek_package_length", String(DEFAULT_PACKAGE.length)],
    ["cdek_package_width", String(DEFAULT_PACKAGE.width)],
    ["cdek_package_height", String(DEFAULT_PACKAGE.height)],
    ["payment_enabled", "1"]
  ]);
  const insert = db.prepare("INSERT OR IGNORE INTO site_settings(key, value, updated_at) VALUES (?, ?, ?)");
  const stamp = nowIso();
  for (const [key, value] of defaults.entries()) {
    insert.run(key, value, stamp);
  }
}


const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
const UTF8_CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

function setUtf8ContentType(res, filePath) {
  const contentType = UTF8_CONTENT_TYPES.get(path.extname(filePath).toLowerCase());
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
}

function sendUtf8File(res, filePath) {
  setUtf8ContentType(res, filePath);
  return res.sendFile(filePath);
}

function setStaticUtf8Headers(res, filePath) {
  setUtf8ContentType(res, filePath);
}

function requireAdminPage(req, res, pagePath) {
  const session = getSession(req);
  if (!session) {
    return res.redirect("/chat");
  }
  if (!session.isAdmin) {
    return res.status(403).type("text/plain; charset=utf-8").send("Доступ только для администратора.");
  }
  return sendUtf8File(res, path.join(ROOT_DIR, pagePath));
}

app.get(["/admin/products", "/admin/products/"], (req, res) => {
  return requireAdminPage(req, res, path.join("admin", "products", "index.html"));
});
app.get(["/admin/banners", "/admin/banners/"], (req, res) => {
  return requireAdminPage(req, res, path.join("admin", "banners", "index.html"));
});
app.get(["/admin/articles", "/admin/articles/"], (req, res) => {
  return requireAdminPage(req, res, path.join("admin", "articles", "index.html"));
});
app.get(["/admin/orders", "/admin/orders/"], (req, res) => {
  return requireAdminPage(req, res, path.join("admin", "orders", "index.html"));
});
app.get(["/admin/payments", "/admin/payments/"], (req, res) => {
  return requireAdminPage(req, res, path.join("admin", "payments", "index.html"));
});
app.get(["/admin/promocodes", "/admin/promocodes/"], (req, res) => {
  return requireAdminPage(req, res, path.join("admin", "promocodes", "index.html"));
});
app.use(express.static(ROOT_DIR, {
  extensions: ["html"],
  setHeaders: setStaticUtf8Headers
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeBase);
      const name = path.basename(safeBase, ext).slice(0, 48) || "file";
      cb(null, `${Date.now()}-${crypto.randomUUID()}-${name}${ext}`);
    }
  }),
  limits: { fileSize: MAX_FILE_SIZE }
});

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRODUCT_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeBase).toLowerCase() || ".jpg";
      const name = path.basename(safeBase, ext).slice(0, 48) || "product";
      cb(null, `${Date.now()}-${crypto.randomUUID()}-${name}${ext}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    return cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE }
});

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeBase).toLowerCase() || ".jpg";
      const name = path.basename(safeBase, ext).slice(0, 48) || "avatar";
      cb(null, `${Date.now()}-${crypto.randomUUID()}-${name}${ext}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    return cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE }
});

function nowIso() {
  return new Date().toISOString();
}

function dayKey(offset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function cleanText(value, limit = 2000) {
  return String(value || "").trim().slice(0, limit);
}

function cleanInteger(value, fallback = 0) {
  const normalized = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function cleanNumber(value, fallback = 0) {
  const normalized = Number(String(value ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : fallback;
}

function boolFromValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === 1 || value === "1") return true;
  const text = String(value).toLowerCase();
  return text === "true" || text === "yes" || text === "on";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48) || `channel-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueSlug(base) {
  const normalized = slugify(base);
  let slug = normalized;
  let suffix = 1;
  const exists = db.prepare("SELECT 1 FROM channels WHERE slug = ?");
  while (exists.get(slug)) {
    suffix += 1;
    slug = `${normalized.slice(0, 40)}-${suffix}`;
  }
  return slug;
}

function uniqueProductSlug(base, productId = null) {
  const normalized = slugify(base).replace(/^channel-/, "product-");
  let slug = normalized || `product-${crypto.randomUUID().slice(0, 8)}`;
  let suffix = 1;
  const exists = db.prepare("SELECT id FROM products WHERE slug = ?");
  while (true) {
    const row = exists.get(slug);
    if (!row || Number(row.id) === Number(productId)) {
      return slug;
    }
    suffix += 1;
    slug = `${normalized.slice(0, 40)}-${suffix}`;
  }
}

function parseBenefits(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 240)).filter(Boolean);
  }
  if (typeof value !== "string") {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => cleanText(item, 240)).filter(Boolean);
    }
  } catch {
    // Plain textarea input is handled below.
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => cleanText(line.replace(/^[•*-]\s*/, ""), 240))
    .filter(Boolean);
}

function parsePackageDimensions(value) {
  const parts = String(value || "")
    .trim()
    .split(/[.\sxх×*,;/]+/iu)
    .map((part) => cleanInteger(part, 0))
    .filter((part) => part > 0);
  if (parts.length < 3) {
    return null;
  }
  return {
    packageLength: cleanPackageDimension(parts[0], DEFAULT_PACKAGE.length),
    packageWidth: cleanPackageDimension(parts[1], DEFAULT_PACKAGE.width),
    packageHeight: cleanPackageDimension(parts[2], DEFAULT_PACKAGE.height)
  };
}

function parsePriceOptions(value) {
  let items = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      items = [];
    } else {
      try {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = trimmed.split(/\r?\n/).map((line) => {
          const [unitPart, pricePart, ...dimensionParts] = line.split(/\s*[-–—:]\s*/);
          return {
            unit: unitPart,
            price: pricePart,
            dimensions: dimensionParts.join(".")
          };
        });
      }
    }
  }

  return items
    .map((item) => {
      const dimensions = parsePackageDimensions(item.dimensions ?? item.packageDimensions ?? item.packageSize);
      const packageLength = cleanInteger(item.packageLength ?? item.package_length, 0);
      const packageWidth = cleanInteger(item.packageWidth ?? item.package_width, 0);
      const packageHeight = cleanInteger(item.packageHeight ?? item.package_height, 0);
      const explicitDimensions = packageLength && packageWidth && packageHeight ? {
        packageLength: cleanPackageDimension(packageLength, DEFAULT_PACKAGE.length),
        packageWidth: cleanPackageDimension(packageWidth, DEFAULT_PACKAGE.width),
        packageHeight: cleanPackageDimension(packageHeight, DEFAULT_PACKAGE.height)
      } : dimensions;
      return {
        unit: cleanText(item.unit, 80),
        price: Math.max(0, cleanInteger(item.price, 0)),
        ...(explicitDimensions || {})
      };
    })
    .filter((item) => item.unit && item.price > 0);
}

function defaultGrainMyceliumPriceOptions() {
  return GRAIN_MYCELIUM_PRICE_OPTIONS.map((option) => ({ ...option }));
}

function clampProductDiscountPercent(value) {
  return Math.min(95, Math.max(0, cleanInteger(value, 0)));
}

function applyProductDiscount(price, discountPercent) {
  const amount = Math.max(0, cleanInteger(price, 0));
  const percent = clampProductDiscountPercent(discountPercent);
  if (!amount || !percent) return amount;
  return Math.max(0, Math.round(amount * (100 - percent) / 100));
}

function isGrainMyceliumProduct(product) {
  const haystack = `${product.title || ""} ${product.category || ""}`.toLocaleLowerCase("ru-RU");
  return haystack.includes("зерновой мицелий");
}

function normalizeProduct(row, { admin = false } = {}) {
  const discountPercent = clampProductDiscountPercent(row.discount_percent);
  const originalPrice = Math.max(0, cleanInteger(row.price, 0));
  const originalPriceOptions = parsePriceOptions(row.price_options_json);
  const discountedPriceOptions = originalPriceOptions.map((item) => ({
    ...item,
    originalPrice: item.price,
    price: applyProductDiscount(item.price, discountPercent)
  }));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    shortDescription: row.short_description,
    description: row.description,
    benefits: parseBenefits(row.benefits_json),
    dosage: row.dosage,
    composition: row.composition,
    notice: row.notice,
    imageUrl: row.image_url,
    price: admin ? originalPrice : applyProductDiscount(originalPrice, discountPercent),
    originalPrice,
    discountPercent,
    unit: row.unit,
    priceOptions: admin ? originalPriceOptions : discountedPriceOptions,
    originalPriceOptions,
    packageLength: cleanPackageDimension(row.package_length, DEFAULT_PACKAGE.length),
    packageWidth: cleanPackageDimension(row.package_width, DEFAULT_PACKAGE.width),
    packageHeight: cleanPackageDimension(row.package_height, DEFAULT_PACKAGE.height),
    hasDiscount: discountPercent > 0,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listProducts({ includeInactive = false } = {}) {
  const where = includeInactive ? "" : "WHERE is_active = 1";
  return db.prepare(`
    SELECT *
    FROM products
    ${where}
    ORDER BY sort_order ASC, id ASC
  `).all().map((row) => normalizeProduct(row, { admin: includeInactive }));
}

function categoryBannerKey(value) {
  return cleanText(value, 160).toLocaleLowerCase("ru-RU");
}

function normalizeCategoryBanner(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    categoryKey: row.category_key,
    imageUrl: row.image_url,
    altText: row.alt_text,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listCategoryBanners({ includeInactive = false } = {}) {
  const where = includeInactive ? "" : "WHERE is_active = 1";
  return db.prepare(`
    SELECT *
    FROM category_banners
    ${where}
    ORDER BY sort_order ASC, id ASC
  `).all().map(normalizeCategoryBanner);
}

function getCategoryBanner(bannerId) {
  return normalizeCategoryBanner(db.prepare("SELECT * FROM category_banners WHERE id = ?").get(Number(bannerId)));
}

function getCategoryBannerByKey(categoryKey) {
  return normalizeCategoryBanner(db.prepare("SELECT * FROM category_banners WHERE category_key = ?").get(categoryKey));
}

function categoryBannerPayloadFromBody(body, existing = {}) {
  const category = cleanText(body.category, 160) || existing.category || "";
  const title = cleanText(body.title, 160) || existing.title || category;
  const categoryKey = categoryBannerKey(category);
  return {
    title,
    category,
    categoryKey,
    imageUrl: cleanText(body.imageUrl ?? body.image_url, 500) || existing.imageUrl || "",
    altText: cleanText(body.altText ?? body.alt_text, 240) || existing.altText || title,
    isActive: body.isActive === false || body.isActive === "false" || body.is_active === 0 || body.is_active === "0" ? 0 : 1,
    sortOrder: cleanInteger(body.sortOrder ?? body.sort_order, existing.sortOrder || 0)
  };
}

function ensureDefaultCategoryBanners() {
  const insert = db.prepare(`
    INSERT INTO category_banners(
      title, category, category_key, image_url, alt_text, is_active, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(category_key) DO NOTHING
  `);
  const stamp = nowIso();
  for (const banner of DEFAULT_CATEGORY_BANNERS) {
    insert.run(
      banner.title,
      banner.category,
      categoryBannerKey(banner.category),
      banner.imageUrl,
      banner.altText,
      1,
      banner.sortOrder,
      stamp,
      stamp
    );
  }
}


function getSetting(key, fallback = "") {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare("INSERT INTO site_settings(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, String(value ?? ""), nowIso());
}

function storeSettingsPayload({ admin = false } = {}) {
  const deliveryEnabled = getSetting("delivery_enabled", "1") === "1";
  const paymentEnabled = getSetting("payment_enabled", "1") === "1";
  const cdekFromLocationCode = getSetting("cdek_from_location_code", "") || process.env.CDEK_FROM_LOCATION_CODE || "";
  const cdekSenderPointCode = getSetting("cdek_sender_point_code", "") || CDEK_SENDER_POINT_CODE;
  const cdekTariffCode = cleanInteger(getSetting("cdek_tariff_code", "") || process.env.CDEK_TARIFF_CODE || DEFAULT_CDEK_TARIFF_CODE, DEFAULT_CDEK_TARIFF_CODE);
  const cdekPackage = cdekPackageSettings();
  const payload = {
    deliveryEnabled,
    paymentEnabled,
    cdekSearchReady: Boolean(CDEK_ACCOUNT && CDEK_SECURE_PASSWORD),
    cdekReady: Boolean(CDEK_ACCOUNT && CDEK_SECURE_PASSWORD && cdekFromLocationCode),
    yookassaReady: Boolean(YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY),
    cdekTariffCode
  };
  if (admin) {
    payload.cdekFromLocationCode = cdekFromLocationCode;
    payload.cdekSenderPointCode = cdekSenderPointCode;
    payload.cdekPackageLength = cdekPackage.length;
    payload.cdekPackageWidth = cdekPackage.width;
    payload.cdekPackageHeight = cdekPackage.height;
    payload.hasCdekCredentials = Boolean(CDEK_ACCOUNT && CDEK_SECURE_PASSWORD);
    payload.hasYookassaCredentials = Boolean(YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY);
  }
  return payload;
}

function getProduct(productId) {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  return row ? normalizeProduct(row, { admin: true }) : null;
}

function getProductBySlug(slug) {
  const row = db.prepare("SELECT * FROM products WHERE slug = ? AND is_active = 1").get(slug);
  return row ? normalizeProduct(row) : null;
}

function productPayloadFromBody(body, existing = {}) {
  const title = cleanText(body.title, 140) || existing.title || "";
  const benefits = parseBenefits(body.benefits);
  const priceOptions = parsePriceOptions(body.priceOptions ?? body.price_options_json ?? existing.priceOptions);
  const baseOption = priceOptions[0];
  const slugBase = cleanText(body.slug, 100) || title;
  return {
    slug: uniqueProductSlug(slugBase, existing.id),
    title,
    subtitle: cleanText(body.subtitle, 160),
    category: cleanText(body.category, 120),
    shortDescription: cleanText(body.shortDescription ?? body.short_description, 420),
    description: cleanText(body.description, 12000),
    benefitsJson: JSON.stringify(benefits),
    dosage: cleanText(body.dosage, 420),
    composition: cleanText(body.composition, 700),
    notice: cleanText(body.notice, 420),
    imageUrl: cleanText(body.imageUrl ?? body.image_url, 500),
    price: Math.max(0, cleanInteger(body.price, baseOption?.price || existing.price || 0)),
    discountPercent: clampProductDiscountPercent(body.discountPercent ?? body.discount_percent ?? existing.discountPercent),
    unit: cleanText(body.unit, 80) || baseOption?.unit || "100 г",
    priceOptionsJson: JSON.stringify(priceOptions),
    packageLength: cleanPackageDimension(body.packageLength ?? body.package_length, existing.packageLength || DEFAULT_PACKAGE.length),
    packageWidth: cleanPackageDimension(body.packageWidth ?? body.package_width, existing.packageWidth || DEFAULT_PACKAGE.width),
    packageHeight: cleanPackageDimension(body.packageHeight ?? body.package_height, existing.packageHeight || DEFAULT_PACKAGE.height),
    isActive: body.isActive === false || body.isActive === "false" || body.is_active === 0 || body.is_active === "0" ? 0 : 1,
    sortOrder: cleanInteger(body.sortOrder ?? body.sort_order, existing.sortOrder || 0)
  };
}

function toDisplayTitle(value) {
  const lower = cleanText(value, 160).toLocaleLowerCase("ru-RU");
  return lower.replace(/(^|[\s-])([a-zа-яё])/giu, (_match, prefix, letter) => (
    `${prefix}${letter.toLocaleUpperCase("ru-RU")}`
  ));
}

function extractField(lines, label) {
  const index = lines.findIndex((line) => line.toLocaleLowerCase("ru-RU").startsWith(label.toLocaleLowerCase("ru-RU")));
  if (index === -1) {
    return "";
  }
  const sameLine = lines[index].slice(label.length).replace(/^:\s*/, "").trim();
  if (sameLine) {
    return sameLine;
  }
  for (const line of lines.slice(index + 1)) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function parseProductsMarkdown() {
  if (!fs.existsSync(PRODUCTS_MD_PATH)) {
    return [];
  }

  const imageFiles = fs.readdirSync(PRODUCT_ASSETS_DIR)
    .filter((fileName) => /\.(jpe?g|png|webp)$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b, "ru"));

  const content = fs.readFileSync(PRODUCTS_MD_PATH, "utf8");
  const blocks = content
    .split(/(?:^|\r?\n)> Shaman:\s*\r?\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rawTitle = (lines.shift() || "").replace(/^[^\p{L}\p{N}]+/u, "");
    const title = toDisplayTitle(rawTitle);
    const bodyLines = lines;
    const benefits = bodyLines
      .filter((line) => line.startsWith("•"))
      .map((line) => cleanText(line.replace(/^•\s*/, ""), 240))
      .filter(Boolean);
    const descriptionLines = [];
    for (const line of bodyLines) {
      if (line.startsWith("•") || /способствует\s*:/i.test(line) || /^Рекомендованная дозировка:/i.test(line) || /^Состав:/i.test(line) || /^Не является/i.test(line)) {
        break;
      }
      descriptionLines.push(line);
    }
    const description = descriptionLines.join("\n\n");
    const fullDescription = bodyLines.join("\n\n");
    const imageName = imageFiles[index] || "";

    return {
      slug: uniqueProductSlug(title),
      title,
      subtitle: "Порошок",
      category: "Зерновой мицелий",
      shortDescription: description.slice(0, 420),
      description: fullDescription,
      benefitsJson: JSON.stringify(benefits),
      dosage: extractField(bodyLines, "Рекомендованная дозировка"),
      composition: extractField(bodyLines, "Состав"),
      notice: bodyLines.find((line) => /^Не является/i.test(line)) || "Не является лекарственным средством.",
      imageUrl: imageName ? `/images/products/${imageName}` : "",
      price: GRAIN_MYCELIUM_PRICE_OPTIONS[0].price,
      unit: "100 г",
      priceOptionsJson: JSON.stringify(defaultGrainMyceliumPriceOptions()),
      isActive: 1,
      sortOrder: index
    };
  });
}

function ensureDefaultProducts() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (count > 0) {
    return;
  }

  const products = parseProductsMarkdown();
  if (!products.length) {
    return;
  }

  const stamp = nowIso();
  const insert = db.prepare(`
    INSERT INTO products(
      slug, title, subtitle, category, short_description, description, benefits_json,
      dosage, composition, notice, image_url, price, discount_percent, unit, price_options_json, is_active, sort_order,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const item of products) {
      insert.run(
        item.slug,
        item.title,
        item.subtitle,
        item.category,
        item.shortDescription,
        item.description,
        item.benefitsJson,
        item.dosage,
        item.composition,
        item.notice,
        item.imageUrl,
        item.price,
        0,
        item.unit,
        item.priceOptionsJson,
        item.isActive,
        item.sortOrder,
        stamp,
        stamp
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function ensureGrainMyceliumPrices() {
  const defaultOptions = defaultGrainMyceliumPriceOptions();
  const optionsJson = JSON.stringify(defaultOptions);
  const rows = db.prepare("SELECT id, title, category, price, unit, price_options_json FROM products").all();
  const update = db.prepare(`
    UPDATE products
    SET price = ?, unit = ?, price_options_json = ?, updated_at = ?
    WHERE id = ?
  `);
  const stamp = nowIso();

  for (const row of rows) {
    if (!isGrainMyceliumProduct(row)) {
      continue;
    }
    if (parsePriceOptions(row.price_options_json).length > 0) {
      continue;
    }
    update.run(defaultOptions[0].price, defaultOptions[0].unit, optionsJson, stamp, row.id);
  }
}

function ensureCuratedCatalogProducts() {
  const existing = new Set(
    db.prepare("SELECT slug FROM products").all().map((row) => String(row.slug || ""))
  );
  const insert = db.prepare(`
    INSERT INTO products(
      slug, title, subtitle, category, short_description, description, benefits_json,
      dosage, composition, notice, image_url, price, discount_percent, unit, price_options_json, is_active, sort_order,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stamp = nowIso();

  for (const product of CURATED_CATALOG_PRODUCTS) {
    if (existing.has(product.slug)) {
      continue;
    }
    insert.run(
      product.slug,
      product.title,
      product.subtitle,
      product.category,
      product.shortDescription,
      product.description,
      JSON.stringify(product.benefits),
      product.dosage,
      product.composition,
      product.notice,
      product.imageUrl,
      product.price,
      0,
      product.unit,
      "[]",
      1,
      product.sortOrder,
      stamp,
      stamp
    );
  }
}


function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePromoCode(value) {
  return cleanText(value, 64).replace(/\s+/g, "").toUpperCase();
}

function normalizeIsoDateTime(value) {
  const text = cleanText(value, 40);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function promoCodeUsageCount(promoId) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM orders
    WHERE promo_details_json != '{}' AND json_extract(promo_details_json, '$.id') = ?
  `).get(Number(promoId))?.count || 0);
}

function normalizePromoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountKind: row.discount_kind,
    discountValue: row.discount_value,
    maxUses: row.max_uses,
    startsAt: row.starts_at || "",
    endsAt: row.ends_at || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicPromoCode(row) {
  const promo = normalizePromoRow(row);
  if (!promo) return null;
  const usageCount = promoCodeUsageCount(promo.id);
  return {
    ...promo,
    usageCount,
    remainingUses: promo.maxUses > 0 ? Math.max(0, promo.maxUses - usageCount) : null
  };
}

function getPromoCodeById(promoId) {
  return normalizePromoRow(db.prepare("SELECT * FROM promo_codes WHERE id = ?").get(Number(promoId)));
}

function getPromoCodeByCode(code) {
  return normalizePromoRow(db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(normalizePromoCode(code)));
}

function promoCodePayloadFromBody(body, existing = null) {
  const discountKind = cleanText(body.discountKind ?? body.discount_kind, 32) === "fixed" ? "fixed" : "percent";
  const payload = {
    code: normalizePromoCode(body.code ?? existing?.code ?? ""),
    description: cleanText(body.description ?? existing?.description, 240),
    discountKind,
    discountValue: Math.max(0, cleanInteger(body.discountValue ?? body.discount_value, existing?.discountValue || 0)),
    maxUses: Math.max(0, cleanInteger(body.maxUses ?? body.max_uses, existing?.maxUses || 0)),
    startsAt: normalizeIsoDateTime(body.startsAt ?? body.starts_at ?? existing?.startsAt),
    endsAt: normalizeIsoDateTime(body.endsAt ?? body.ends_at ?? existing?.endsAt),
    isActive: boolFromValue(body.isActive ?? body.is_active, existing?.isActive ?? true)
  };
  if (payload.discountKind === "percent") {
    payload.discountValue = Math.min(100, payload.discountValue || 0);
  }
  return payload;
}

function promoDiscountAmount(promo, subtotal) {
  const base = Math.max(0, cleanInteger(subtotal, 0));
  if (!promo || base <= 0) return 0;
  if (promo.discountKind === "fixed") {
    return Math.min(base, Math.max(0, cleanInteger(promo.discountValue, 0)));
  }
  const percent = Math.min(100, Math.max(0, cleanInteger(promo.discountValue, 0)));
  return Math.min(base, Math.round(base * percent / 100));
}

function validatePromoCodeForSubtotal(promo, subtotal) {
  if (!promo) {
    return { ok: false, error: "Промокод не найден." };
  }
  if (!promo.isActive) {
    return { ok: false, error: "Промокод отключён." };
  }
  const now = Date.now();
  if (promo.startsAt) {
    const startsAt = new Date(promo.startsAt).getTime();
    if (Number.isFinite(startsAt) && startsAt > now) {
      return { ok: false, error: "Промокод ещё не активен." };
    }
  }
  if (promo.endsAt) {
    const endsAt = new Date(promo.endsAt).getTime();
    if (Number.isFinite(endsAt) && endsAt < now) {
      return { ok: false, error: "Срок действия промокода истёк." };
    }
  }
  const usageCount = promoCodeUsageCount(promo.id);
  if (promo.maxUses > 0 && usageCount >= promo.maxUses) {
    return { ok: false, error: "Лимит использований промокода исчерпан." };
  }
  const discountAmount = promoDiscountAmount(promo, subtotal);
  if (discountAmount <= 0) {
    return { ok: false, error: "Промокод не даёт скидку для этой корзины." };
  }
  return {
    ok: true,
    promo: {
      id: promo.id,
      code: promo.code,
      description: promo.description,
      discountKind: promo.discountKind,
      discountValue: promo.discountValue,
      discountAmount,
      usageCount,
      maxUses: promo.maxUses,
      remainingUses: promo.maxUses > 0 ? Math.max(0, promo.maxUses - usageCount) : null
    }
  };
}

function resolvePromoCode(code, subtotal) {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) {
    return { ok: true, promo: null };
  }
  return validatePromoCodeForSubtotal(getPromoCodeByCode(normalizedCode), subtotal);
}

function publicOrder(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    publicId: row.public_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerComment: row.customer_comment,
    items: parseJsonField(row.items_json, []),
    delivery: parseJsonField(row.delivery_json, {}),
    promo: parseJsonField(row.promo_details_json, {}),
    promoCode: row.promo_code || "",
    promoDiscountAmount: row.promo_discount_amount || 0,
    subtotal: row.subtotal,
    deliveryPrice: row.delivery_price,
    total: row.total,
    status: row.status,
    paymentProvider: row.payment_provider,
    paymentId: row.payment_id,
    paymentUrl: row.payment_url,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function yookassaOrderStatus(paymentStatus, currentStatus = "") {
  const normalized = cleanText(paymentStatus, 64);
  if (normalized === "succeeded") {
    return "paid";
  }
  if (normalized === "canceled") {
    return "payment_canceled";
  }
  if (normalized === "waiting_for_capture") {
    return "payment_waiting_capture";
  }
  if (currentStatus === "paid" || currentStatus === "payment_canceled") {
    return currentStatus;
  }
  return "payment_pending";
}

function findOrderForYookassaPayment(payment) {
  const paymentId = cleanText(payment?.id, 120);
  const metadataOrderId = cleanInteger(payment?.metadata?.orderId, 0);
  if (metadataOrderId) {
    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(metadataOrderId);
    if (row) {
      return row;
    }
  }
  if (paymentId) {
    const row = db.prepare("SELECT * FROM orders WHERE payment_id = ?").get(paymentId);
    if (row) {
      return row;
    }
  }
  return null;
}

function applyYookassaWebhook(payment) {
  const orderRow = findOrderForYookassaPayment(payment);
  if (!orderRow) {
    return null;
  }
  const paymentId = cleanText(payment?.id, 120);
  const paymentStatus = cleanText(payment?.status, 64);
  const confirmationUrl = cleanText(payment?.confirmation?.confirmation_url, 500);
  const nextStatus = yookassaOrderStatus(paymentStatus, orderRow.status);
  db.prepare(`
    UPDATE orders
    SET payment_id = ?, payment_url = ?, payment_status = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    paymentId || orderRow.payment_id || "",
    confirmationUrl || orderRow.payment_url || "",
    paymentStatus || orderRow.payment_status || "",
    nextStatus,
    nowIso(),
    orderRow.id
  );
  return publicOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(orderRow.id));
}

function weightFromUnit(unit) {
  const text = String(unit || "").toLowerCase();
  const value = cleanNumber(text, 0);
  if (!value) return 100;
  if (text.includes("\u043a\u0433") || text.includes("kg")) return Math.round(value * 1000);
  return Math.round(value);
}

function normalizeOrderItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  const normalized = [];
  for (const raw of items) {
    const product = getProductBySlug(cleanText(raw.slug, 100));
    if (!product) continue;
    const requestedUnit = cleanText(raw.unit, 80) || product.unit;
    const option = product.priceOptions.find((item) => item.unit === requestedUnit) || product.priceOptions[0] || { unit: product.unit, price: product.price };
    const quantity = Math.min(99, Math.max(1, cleanInteger(raw.quantity, 1)));
    const unit = option.unit || product.unit || "\u0448\u0442";
    const price = Math.max(0, cleanInteger(option.price, product.price));
    const hasOptionPackage = option.packageLength && option.packageWidth && option.packageHeight;
    const packageLength = hasOptionPackage
      ? cleanPackageDimension(option.packageLength, DEFAULT_PACKAGE.length)
      : cleanPackageDimension(product.packageLength, DEFAULT_PACKAGE.length);
    const packageWidth = hasOptionPackage
      ? cleanPackageDimension(option.packageWidth, DEFAULT_PACKAGE.width)
      : cleanPackageDimension(product.packageWidth, DEFAULT_PACKAGE.width);
    const packageHeight = hasOptionPackage
      ? cleanPackageDimension(option.packageHeight, DEFAULT_PACKAGE.height)
      : cleanPackageDimension(product.packageHeight, DEFAULT_PACKAGE.height);
    normalized.push({
      slug: product.slug,
      title: product.title,
      unit,
      quantity,
      price,
      amount: price * quantity,
      weight: weightFromUnit(unit) * quantity,
      packageLength: packageLength * quantity,
      packageWidth: packageWidth * quantity,
      packageHeight: packageHeight * quantity
    });
  }
  return normalized;
}

function orderTotals(items, deliveryPrice = 0, discountAmount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const delivery = Math.max(0, cleanInteger(deliveryPrice, 0));
  const discount = Math.min(subtotal, Math.max(0, cleanInteger(discountAmount, 0)));
  return { subtotal, discountAmount: discount, deliveryPrice: delivery, total: subtotal - discount + delivery };
}

function cleanPackageDimension(value, fallback) {
  return Math.min(200, Math.max(1, cleanInteger(value, fallback)));
}

function cdekPackageSettings() {
  return {
    length: cleanPackageDimension(getSetting("cdek_package_length", DEFAULT_PACKAGE.length), DEFAULT_PACKAGE.length),
    width: cleanPackageDimension(getSetting("cdek_package_width", DEFAULT_PACKAGE.width), DEFAULT_PACKAGE.width),
    height: cleanPackageDimension(getSetting("cdek_package_height", DEFAULT_PACKAGE.height), DEFAULT_PACKAGE.height)
  };
}

function cdekConfigured() {
  return Boolean(CDEK_ACCOUNT && CDEK_SECURE_PASSWORD);
}

function sendCdekClientError(res, error) {
  if (!error.cdekResponse) {
    return false;
  }
  const status = error.cdekResponse.status >= 500 ? 502 : 400;
  res.status(status).json({ error: `CDEK: ${error.message || "Не удалось рассчитать доставку."}` });
  return true;
}

let cdekTokenCache = { token: "", expiresAt: 0 };

async function cdekToken() {
  if (!cdekConfigured()) {
    throw new Error("CDEK credentials are not configured.");
  }
  if (cdekTokenCache.token && cdekTokenCache.expiresAt > Date.now() + 60000) {
    return cdekTokenCache.token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CDEK_ACCOUNT,
    client_secret: CDEK_SECURE_PASSWORD
  });
  const response = await fetch(`${CDEK_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || "CDEK authorization failed.");
  }
  cdekTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(1, Number(data.expires_in || 3600) - 120) * 1000
  };
  return cdekTokenCache.token;
}

async function cdekFetch(endpoint, options = {}) {
  const { includeMeta = false, ...fetchOptions } = options;
  const token = await cdekToken();
  const response = await fetch(`${CDEK_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(fetchOptions.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.errors?.[0]?.message || data.message || "CDEK request failed.";
    const error = new Error(message);
    error.cdekResponse = {
      url: response.url,
      status: response.status,
      body: data
    };
    throw error;
  }
  if (includeMeta) {
    return {
      data,
      status: response.status,
      url: response.url
    };
  }
  return data;
}

function orderPackageFromItems(items) {
  const fallbackPackage = cdekPackageSettings();
  const packageLength = items.reduce((sum, item) => sum + Math.max(0, cleanInteger(item.packageLength, 0)), 0);
  const packageWidth = items.reduce((sum, item) => sum + Math.max(0, cleanInteger(item.packageWidth, 0)), 0);
  const packageHeight = items.reduce((sum, item) => sum + Math.max(0, cleanInteger(item.packageHeight, 0)), 0);
  return {
    weight: Math.max(100, items.reduce((sum, item) => sum + item.weight, 0)),
    length: Math.max(1, packageLength || fallbackPackage.length),
    width: Math.max(1, packageWidth || fallbackPackage.width),
    height: Math.max(1, packageHeight || fallbackPackage.height)
  };
}

async function calculateCdekDelivery({ cityCode, deliveryPointCode, items, includeDebug = false }) {
  const fromLocationCode = cleanInteger(getSetting("cdek_from_location_code", ""), 0);
  const senderPointCode = cleanText(getSetting("cdek_sender_point_code", CDEK_SENDER_POINT_CODE), 80);
  const tariffCode = cleanInteger(getSetting("cdek_tariff_code", DEFAULT_CDEK_TARIFF_CODE), DEFAULT_CDEK_TARIFF_CODE);
  if (!fromLocationCode) {
    throw new Error("Set CDEK sender city code in admin settings.");
  }
  const toLocationCode = cleanInteger(cityCode, 0);
  if (!toLocationCode) {
    throw new Error("Choose delivery city.");
  }
  const deliveryPointCodeClean = cleanText(deliveryPointCode, 80);
  const payload = {
    type: 1,
    tariff_code: tariffCode,
    from_location: { code: fromLocationCode },
    to_location: { code: toLocationCode },
    packages: [orderPackageFromItems(items)]
  };
  if (senderPointCode && deliveryPointCodeClean) {
    payload.shipment_point = senderPointCode;
    payload.delivery_point = deliveryPointCodeClean;
  }
  const endpoint = "/calculator/tariff";
  const request = {
    method: "POST",
    url: `${CDEK_BASE_URL}${endpoint}`,
    body: payload
  };
  let cdekResponse;
  try {
    cdekResponse = await cdekFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      includeMeta: includeDebug
    });
  } catch (error) {
    if (includeDebug && error.cdekResponse) {
      error.cdekDebug = {
        request,
        response: error.cdekResponse
      };
    }
    throw error;
  }
  const result = includeDebug ? cdekResponse.data : cdekResponse;
  const delivery = {
    provider: "cdek",
    tariffCode,
    shipmentPointCode: senderPointCode || null,
    senderPointCode,
    cityCode: toLocationCode,
    deliveryPointCode: deliveryPointCodeClean,
    package: payload.packages[0],
    price: Math.ceil(cleanNumber(result.total_sum ?? result.delivery_sum, 0)),
    periodMin: result.period_min || null,
    periodMax: result.period_max || null,
    raw: result
  };
  if (includeDebug) {
    delivery.debug = {
      request,
      response: {
        url: cdekResponse.url,
        status: cdekResponse.status,
        body: result
      }
    };
  }
  return delivery;
}

function yookassaConfigured() {
  return Boolean(YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY);
}

function yookassaReceiptCustomer(order) {
  const email = cleanText(order.customerEmail, 160);
  if (!email) {
    throw new Error("Customer email is required for YooKassa receipt.");
  }
  const phone = cleanText(order.customerPhone, 40).replace(/[^\d+]/g, "");
  const fullName = cleanText(order.customerName, 128);
  return {
    email,
    ...(phone ? { phone } : {}),
    ...(fullName ? { full_name: fullName } : {})
  };
}

function discountedOrderItems(order) {
  const items = Array.isArray(order.items) ? order.items.map((item) => ({
    ...item,
    amount: Math.max(0, cleanInteger(item.amount, cleanInteger(item.price, 0) * cleanInteger(item.quantity, 1)))
  })) : [];
  const discountAmount = Math.min(
    items.reduce((sum, item) => sum + item.amount, 0),
    Math.max(0, cleanInteger(order.promoDiscountAmount || order.promo?.discountAmount, 0))
  );
  if (!items.length || discountAmount <= 0) {
    return items;
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const allocations = items.map((item) => {
    const raw = discountAmount * item.amount / subtotal;
    return {
      amount: Math.floor(raw),
      remainder: raw - Math.floor(raw)
    };
  });
  let remainder = discountAmount - allocations.reduce((sum, item) => sum + item.amount, 0);
  const orderByRemainder = allocations
    .map((item, index) => ({ index, remainder: item.remainder }))
    .sort((left, right) => right.remainder - left.remainder);
  for (const entry of orderByRemainder) {
    if (remainder <= 0) break;
    allocations[entry.index].amount += 1;
    remainder -= 1;
  }

  return items.map((item, index) => ({
    ...item,
    amount: Math.max(0, item.amount - allocations[index].amount)
  }));
}

function yookassaReceiptItems(order) {
  const items = discountedOrderItems(order).map((item) => ({
    description: cleanText(`${item.title}${item.unit ? `, ${item.unit}` : ""}${item.quantity > 1 ? ` x${item.quantity}` : ""}`, 128),
    quantity: "1.000",
    amount: {
      value: Number(item.amount || 0).toFixed(2),
      currency: "RUB"
    },
    vat_code: 1,
    payment_mode: "full_prepayment",
    payment_subject: "commodity"
  }));
  if (order.deliveryPrice > 0) {
    items.push({
      description: "Доставка",
      quantity: "1.000",
      amount: {
        value: Number(order.deliveryPrice || 0).toFixed(2),
        currency: "RUB"
      },
      vat_code: 1,
      payment_mode: "full_prepayment",
      payment_subject: "service"
    });
  }
  return items;
}

async function createYookassaPayment(order) {
  if (!yookassaConfigured()) {
    throw new Error("YooKassa credentials are not configured.");
  }
  const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString("base64");
  const payload = {
    amount: { value: Number(order.total).toFixed(2), currency: "RUB" },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: `${SITE_URL}/payment.html?order=${encodeURIComponent(order.publicId)}`
    },
    description: `Order ${order.publicId} on shamanchik.ru`.slice(0, 128),
    metadata: { orderId: String(order.id), publicId: order.publicId },
    receipt: {
      customer: yookassaReceiptCustomer(order),
      items: yookassaReceiptItems(order)
    }
  };
  const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotence-Key": crypto.randomUUID()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.description || data.message || "YooKassa payment creation failed.");
  }
  return data;
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      return acc;
    }
    acc[name] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || "/"}`];
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }
  res.append("Set-Cookie", parts.join("; "));
}

function issueSessionCookie(req, res, token) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  setCookie(res, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    maxAge: SESSION_TTL_MS
  });
}

function clearSessionCookie(req, res) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  setCookie(res, SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    maxAge: 0
  });
}

function isAdminUser(user) {
  return ADMIN_USERNAMES.has(String(user?.username || "").toLowerCase());
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) {
    return null;
  }

  const session = db.prepare(`
    SELECT
      s.id AS sessionId,
      s.user_id AS userId,
      s.expires_at AS expiresAt,
      u.id AS id,
      u.username,
      u.display_name AS displayName,
      u.avatar_url AS avatarUrl,
      u.bio,
      u.location,
      u.created_at AS createdAt,
      u.last_login_at AS lastLoginAt,
      u.last_seen_at AS lastSeenAt
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(token);

  if (!session) {
    return null;
  }

  if (Date.parse(session.expiresAt) < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
    return null;
  }

  const stamp = nowIso();
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(stamp, token);
  db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(stamp, session.userId);

  return {
    ...session,
    isAdmin: isAdminUser(session)
  };
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Требуется авторизация." });
  }
  req.user = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Требуется авторизация." });
  }
  if (!session.isAdmin) {
    return res.status(403).json({ error: "Доступ только для администратора." });
  }
  req.user = session;
  next();
}

function publicUserProfile(userId) {
  const user = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name AS displayName,
      u.avatar_url AS avatarUrl,
      u.bio,
      u.location,
      u.created_at AS createdAt,
      u.last_login_at AS lastLoginAt,
      u.last_seen_at AS lastSeenAt,
      (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS messageCount,
      (SELECT COUNT(*) FROM channels c WHERE c.owner_user_id = u.id) AS createdChannelsCount,
      (SELECT COUNT(*) FROM channel_members cm WHERE cm.user_id = u.id) AS joinedChannelsCount
    FROM users u
    WHERE u.id = ?
  `).get(userId);

  if (!user) {
    return null;
  }

  return {
    ...user,
    isAdmin: isAdminUser(user)
  };
}

function ensureChannelMembership(channelId, userId, role = "member") {
  db.prepare(`
    INSERT INTO channel_members(channel_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(channel_id, user_id) DO NOTHING
  `).run(channelId, userId, role, nowIso());
}

function markChannelActivity(channelId, userId) {
  ensureChannelMembership(channelId, userId);
  const stamp = nowIso();
  db.prepare(`
    INSERT INTO channel_visits(channel_id, user_id, first_seen_at, last_seen_at, visits_count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(channel_id, user_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      visits_count = channel_visits.visits_count + 1
  `).run(channelId, userId, stamp, stamp);

  db.prepare(`
    INSERT INTO channel_daily_activity(channel_id, user_id, activity_date)
    VALUES (?, ?, ?)
    ON CONFLICT(channel_id, user_id, activity_date) DO NOTHING
  `).run(channelId, userId, dayKey(0));
}

function getOnlineUsers(channelId) {
  const sockets = channelSubscribers.get(channelId) || new Set();
  const users = new Map();
  for (const socket of sockets) {
    if (!socket.userId || users.has(socket.userId)) {
      continue;
    }
    const profile = publicUserProfile(socket.userId);
    if (profile) {
      users.set(socket.userId, profile);
    }
  }
  return [...users.values()];
}

function getChannelStats(channelId) {
  return {
    onlineCount: getOnlineUsers(channelId).length,
    visitorCount: db.prepare("SELECT COUNT(*) AS count FROM channel_visits WHERE channel_id = ?").get(channelId).count,
    dau: db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM channel_daily_activity WHERE channel_id = ? AND activity_date >= ?").get(channelId, dayKey(0)).count,
    wau: db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM channel_daily_activity WHERE channel_id = ? AND activity_date >= ?").get(channelId, dayKey(6)).count,
    mau: db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM channel_daily_activity WHERE channel_id = ? AND activity_date >= ?").get(channelId, dayKey(29)).count
  };
}

function getChannelSummary(channelId, currentUserId) {
  const channel = db.prepare(`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.description,
      c.kind,
      c.owner_user_id AS ownerUserId,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      u.display_name AS ownerDisplayName,
      EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) AS isMember,
      (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messageCount,
      (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS memberCount
    FROM channels c
    JOIN users u ON u.id = c.owner_user_id
    WHERE c.id = ?
  `).get(currentUserId, channelId);

  if (!channel) {
    return null;
  }

  return {
    ...channel,
    stats: getChannelStats(channel.id)
  };
}

function createChannel({ name, description, ownerUserId, kind = "public" }) {
  const stamp = nowIso();
  const result = db.prepare(`
    INSERT INTO channels(slug, name, description, kind, owner_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uniqueSlug(name), cleanText(name, 80), cleanText(description, 280), kind, ownerUserId, stamp, stamp);

  const channelId = Number(result.lastInsertRowid);
  ensureChannelMembership(channelId, ownerUserId, "owner");
  return getChannelSummary(channelId, ownerUserId);
}

function ensureDefaultChannels() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM channels").get().count;
  if (count > 0) {
    return;
  }
  const owner = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get();
  if (!owner) {
    return;
  }
  createChannel({
    name: "Общий чат",
    description: "Главный канал лавки: вопросы, отзывы, обсуждение товаров и атмосфера леса.",
    ownerUserId: owner.id
  });
  createChannel({
    name: "Подбор продукта",
    description: "Канал для вопросов по подбору курса, дозировки и сочетаний товаров.",
    ownerUserId: owner.id
  });
  createChannel({
    name: "Дары леса",
    description: "Новости лавки, редкие позиции, сезонные подборки и обновления.",
    ownerUserId: owner.id
  });
}

function ensurePersonalChannel(userId, displayName) {
  const existing = db.prepare(`
    SELECT id
    FROM channels
    WHERE owner_user_id = ? AND kind = 'personal'
    LIMIT 1
  `).get(userId);

  if (existing) {
    ensureChannelMembership(existing.id, userId, "owner");
    return existing.id;
  }

  const created = createChannel({
    name: `Канал ${displayName}`,
    description: "Личная комната пользователя. Здесь можно вести свои темы и оформлять собственный канал.",
    ownerUserId: userId,
    kind: "personal"
  });
  return created.id;
}

function listChannels(currentUserId, search = "") {
  const normalizedSearch = cleanText(search, 80).toLowerCase();
  const channels = db.prepare(`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.description,
      c.kind,
      c.owner_user_id AS ownerUserId,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      u.display_name AS ownerDisplayName,
      EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) AS isMember,
      (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messageCount,
      (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS memberCount
    FROM channels c
    JOIN users u ON u.id = c.owner_user_id
    ORDER BY
      CASE
        WHEN c.owner_user_id = ? THEN 0
        WHEN EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) THEN 1
        ELSE 2
      END,
      c.updated_at DESC
  `).all(currentUserId, currentUserId, currentUserId).map((channel) => ({
    ...channel,
    stats: getChannelStats(channel.id)
  }));

  if (!normalizedSearch) {
    return channels;
  }

  return channels.filter((channel) => {
    const haystacks = [
      channel.name,
      channel.description,
      channel.ownerDisplayName
    ];
    return haystacks.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  });
}

function listChannelMessages(channelId) {
  return db.prepare(`
    SELECT
      m.id,
      m.channel_id AS channelId,
      m.content,
      m.attachment_url AS attachmentUrl,
      m.attachment_name AS attachmentName,
      m.attachment_type AS attachmentType,
      m.attachment_size AS attachmentSize,
      m.created_at AS createdAt,
      u.id AS userId,
      u.username,
      u.display_name AS displayName
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
    ORDER BY m.id DESC
    LIMIT 100
  `).all(channelId).reverse();
}

function getMessageReactionMap(messageIds, viewerId) {
  if (!messageIds.length) {
    return new Map();
  }

  const placeholders = messageIds.map(() => "?").join(", ");
  const rows = db.prepare(`
    SELECT
      message_id AS messageId,
      emoji,
      user_id AS userId
    FROM message_reactions
    WHERE message_id IN (${placeholders})
    ORDER BY id ASC
  `).all(...messageIds);

  const map = new Map();
  for (const messageId of messageIds) {
    map.set(messageId, new Map());
  }

  for (const row of rows) {
    if (!map.has(row.messageId)) {
      map.set(row.messageId, new Map());
    }
    const bucket = map.get(row.messageId);
    if (!bucket.has(row.emoji)) {
      bucket.set(row.emoji, {
        emoji: row.emoji,
        count: 0,
        reacted: false
      });
    }
    const summary = bucket.get(row.emoji);
    summary.count += 1;
    if (viewerId && row.userId === viewerId) {
      summary.reacted = true;
    }
  }

  const sorted = new Map();
  for (const [messageId, reactions] of map.entries()) {
    const items = [...reactions.values()].sort((left, right) => {
      const leftIndex = REACTION_OPTIONS.indexOf(left.emoji);
      const rightIndex = REACTION_OPTIONS.indexOf(right.emoji);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });
    sorted.set(messageId, items);
  }

  return sorted;
}

function getMessageReactions(messageId, viewerId) {
  return getMessageReactionMap([messageId], viewerId).get(messageId) || [];
}

function listChannelUsers(channelId) {
  const onlineIds = new Set(getOnlineUsers(channelId).map((user) => user.id));
  return db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name AS displayName,
      u.bio,
      u.location,
      u.created_at AS createdAt,
      u.last_login_at AS lastLoginAt,
      u.last_seen_at AS lastSeenAt,
      cm.role,
      cm.joined_at AS joinedAt,
      (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS messageCount,
      (SELECT COUNT(*) FROM channels c WHERE c.owner_user_id = u.id) AS createdChannelsCount,
      (SELECT COUNT(*) FROM channel_members cm2 WHERE cm2.user_id = u.id) AS joinedChannelsCount
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = ?
    ORDER BY cm.role = 'owner' DESC, u.display_name COLLATE NOCASE ASC
  `).all(channelId).map((user) => ({
    ...user,
    isOnline: onlineIds.has(user.id),
    isAdmin: isAdminUser(user)
  }));
}

function getChannelWithAutoJoin(channelId, userId) {
  const channel = getChannelSummary(channelId, userId);
  if (!channel) {
    return null;
  }
  ensureChannelMembership(channelId, userId, channel.ownerUserId === userId ? "owner" : "member");
  markChannelActivity(channelId, userId);
  return getChannelSummary(channelId, userId);
}

function createSession(userId) {
  const sessionId = crypto.randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO sessions(id, user_id, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, createdAt, expiresAt, createdAt);
  return sessionId;
}

function deleteSession(sessionId) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

function withMessagePermissions(message, viewer) {
  return {
    ...message,
    hasAttachment: Boolean(message.attachmentUrl),
    canDelete: Boolean(viewer && (viewer.id === message.userId || isAdminUser(viewer))),
    reactions: Array.isArray(message.reactions) ? message.reactions : []
  };
}

function enrichMessages(messages, viewer) {
  const reactionMap = getMessageReactionMap(messages.map((message) => message.id), viewer?.id);
  return messages.map((message) => withMessagePermissions({
    ...message,
    reactions: reactionMap.get(message.id) || []
  }, viewer));
}

function normalizePushSubscription(input) {
  const endpoint = String(input?.endpoint || "").trim();
  const p256dh = String(input?.keys?.p256dh || "").trim();
  const auth = String(input?.keys?.auth || "").trim();
  if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !auth) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

function savePushSubscription(userId, subscription) {
  const stamp = nowIso();
  db.prepare(`
    INSERT INTO push_subscriptions(endpoint, user_id, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = excluded.updated_at
  `).run(subscription.endpoint, userId, subscription.p256dh, subscription.auth, stamp, stamp);
}

function deletePushSubscription(endpoint) {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

function listChannelPushSubscriptions(channelId, excludeUserId) {
  return db.prepare(`
    SELECT
      ps.endpoint,
      ps.p256dh,
      ps.auth,
      ps.user_id AS userId
    FROM push_subscriptions ps
    JOIN channel_members cm ON cm.user_id = ps.user_id
    WHERE cm.channel_id = ? AND ps.user_id <> ?
  `).all(channelId, excludeUserId);
}

function pushSubscriptionPayload(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth
    }
  };
}

function notificationText(message) {
  const content = cleanText(message.content, 120);
  if (content) {
    return content;
  }
  return message.attachmentName ? `Файл: ${message.attachmentName}` : "Новое сообщение";
}

function sendChannelMessagePush(channel, message, actor) {
  const subscriptions = listChannelPushSubscriptions(channel.id, actor.id);
  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    title: `${message.displayName} · ${channel.name}`,
    body: notificationText(message),
    url: `/chat?channel=${channel.id}`,
    icon: "/images/pwa-icon-192.png",
    badge: "/images/icon-64.png"
  });

  for (const subscription of subscriptions) {
    webPush.sendNotification(pushSubscriptionPayload(subscription), payload).catch((error) => {
      if (error.statusCode === 404 || error.statusCode === 410) {
        deletePushSubscription(subscription.endpoint);
        return;
      }
      console.error("Web Push delivery failed:", error);
    });
  }
}

const channelSubscribers = new Map();

function broadcastToChannel(channelId, payload) {
  const sockets = channelSubscribers.get(channelId);
  if (!sockets) {
    return;
  }
  const message = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}

function broadcastPresence(channelId) {
  broadcastToChannel(channelId, {
    type: "presence",
    users: getOnlineUsers(channelId),
    stats: getChannelStats(channelId)
  });
}

function subscribeSocket(ws, channelId) {
  if (ws.channelId && ws.channelId !== channelId) {
    unsubscribeSocket(ws);
  }
  ws.channelId = channelId;
  if (!channelSubscribers.has(channelId)) {
    channelSubscribers.set(channelId, new Set());
  }
  channelSubscribers.get(channelId).add(ws);
  broadcastPresence(channelId);
}

function unsubscribeSocket(ws) {
  if (!ws.channelId) {
    return;
  }
  const sockets = channelSubscribers.get(ws.channelId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      channelSubscribers.delete(ws.channelId);
    } else {
      broadcastPresence(ws.channelId);
    }
  }
  ws.channelId = null;
}

function authPayload(userId) {
  const user = publicUserProfile(userId);
  if (!user) {
    return null;
  }
  ensureDefaultChannels();
  ensurePersonalChannel(userId, user.displayName);
  return {
    user,
    channels: listChannels(userId)
  };
}

registerArticlesModule({
  app,
  db,
  ROOT_DIR,
  STORAGE_DIR,
  cleanText,
  cleanInteger,
  boolFromValue,
  slugify,
  nowIso,
  parseCookies,
  setCookie,
  requireAuth,
  requireAdmin,
  getSession,
  publicUserProfile,
  isAdminUser
});

function deleteMessageAndBroadcast(message, actor) {
  db.prepare("DELETE FROM messages WHERE id = ?").run(message.id);
  db.prepare("UPDATE channels SET updated_at = ? WHERE id = ?").run(nowIso(), message.channelId);

  if (message.attachmentUrl) {
    const filePath = path.join(UPLOAD_DIR, path.basename(message.attachmentUrl));
    fs.unlink(filePath, () => {});
  }

  const channel = getChannelSummary(message.channelId, actor.id);
  broadcastToChannel(message.channelId, {
    type: "messageDeleted",
    messageId: message.id,
    channel
  });
  broadcastPresence(message.channelId);
  return channel;
}

function deleteChannelAndBroadcast(channelId, actor) {
  const channel = db.prepare(`
    SELECT
      id,
      owner_user_id AS ownerUserId
    FROM channels
    WHERE id = ?
  `).get(channelId);

  if (!channel) {
    return null;
  }

  const attachments = db.prepare(`
    SELECT attachment_url AS attachmentUrl
    FROM messages
    WHERE channel_id = ? AND attachment_url IS NOT NULL
  `).all(channelId);

  broadcastToChannel(channelId, {
    type: "channelDeleted",
    channelId
  });

  const sockets = channelSubscribers.get(channelId);
  if (sockets) {
    for (const ws of sockets) {
      ws.channelId = null;
    }
    channelSubscribers.delete(channelId);
  }

  db.prepare("DELETE FROM channels WHERE id = ?").run(channelId);

  for (const attachment of attachments) {
    if (!attachment.attachmentUrl) {
      continue;
    }
    fs.unlink(path.join(UPLOAD_DIR, path.basename(attachment.attachmentUrl)), () => {});
  }

  return {
    deletedChannelId: channelId,
    channels: listChannels(actor.id)
  };
}

function toggleMessageReaction(messageId, emoji, actor) {
  const normalizedEmoji = String(emoji || "").trim();
  if (!REACTION_OPTIONS.includes(normalizedEmoji)) {
    const error = new Error("Недопустимая реакция.");
    error.statusCode = 400;
    throw error;
  }

  const message = db.prepare(`
    SELECT
      id,
      channel_id AS channelId
    FROM messages
    WHERE id = ?
  `).get(messageId);

  if (!message) {
    const error = new Error("Сообщение не найдено.");
    error.statusCode = 404;
    throw error;
  }

  const channel = getChannelWithAutoJoin(message.channelId, actor.id);
  if (!channel) {
    const error = new Error("Канал не найден.");
    error.statusCode = 404;
    throw error;
  }

  const existing = db.prepare(`
    SELECT id
    FROM message_reactions
    WHERE message_id = ? AND user_id = ? AND emoji = ?
  `).get(messageId, actor.id, normalizedEmoji);

  if (existing) {
    db.prepare("DELETE FROM message_reactions WHERE id = ?").run(existing.id);
  } else {
    db.prepare(`
      INSERT INTO message_reactions(message_id, user_id, emoji, created_at)
      VALUES (?, ?, ?, ?)
    `).run(messageId, actor.id, normalizedEmoji, nowIso());
  }

  const reactions = getMessageReactions(messageId, actor.id);
  broadcastToChannel(message.channelId, {
    type: "messageReactionsUpdated",
    messageId,
    channelId: message.channelId,
    reactions
  });

  return {
    messageId,
    channel,
    reactions
  };
}

app.use("/chat-assets", express.static(CHAT_DIR, {
  setHeaders: setStaticUtf8Headers
}));
app.use("/chat-uploads", express.static(UPLOAD_DIR));
app.use("/product-images", express.static(PRODUCT_UPLOAD_DIR));

for (const [routePath, fileName] of STATIC_PAGES.entries()) {
  app.get(routePath, (_req, res) => {
    sendUtf8File(res, path.join(ROOT_DIR, fileName));
  });
}

app.get(["/chat", "/chat/"], (_req, res) => {
  sendUtf8File(res, path.join(CHAT_DIR, "index.html"));
});

app.get(["/chat/admin", "/chat/admin/"], (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.redirect("/chat");
  }
  if (!session.isAdmin) {
    return res.status(403).type("text/plain; charset=utf-8").send("Доступ только для администратора.");
  }
  return sendUtf8File(res, path.join(CHAT_DIR, "admin.html"));
});

app.get(["/api/products", "/chat-api/products"], (_req, res) => {
  res.json({ products: listProducts() });
});

app.get(["/api/products/:slug", "/chat-api/products/:slug"], (req, res) => {
  const product = getProductBySlug(cleanText(req.params.slug, 100));
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }
  res.json({ product });
});

app.get(["/api/banners", "/chat-api/banners"], (_req, res) => {
  res.json({ banners: listCategoryBanners() });
});


app.get(["/api/store/settings", "/chat-api/store/settings"], (_req, res) => {
  res.json(storeSettingsPayload());
});

app.get(["/api/delivery/cities", "/chat-api/delivery/cities"], async (req, res, next) => {
  try {
    const query = cleanText(req.query.q, 80);
    if (!query || query.length < 2) {
      return res.json({ cities: [] });
    }
    if (!cdekConfigured()) {
      return res.status(503).json({ error: "CDEK is not configured." });
    }
    const data = await cdekFetch(`/location/cities?country_codes=RU&city=${encodeURIComponent(query)}&size=12`);
    const cities = (Array.isArray(data) ? data : []).map((city) => ({
      code: city.code,
      name: city.city,
      region: city.region,
      country: city.country
    }));
    res.json({ cities });
  } catch (error) {
    if (sendCdekClientError(res, error)) {
      return;
    }
    next(error);
  }
});

app.get(["/api/delivery/points", "/chat-api/delivery/points"], async (req, res, next) => {
  try {
    const cityCode = cleanInteger(req.query.cityCode, 0);
    if (!cityCode) {
      return res.status(400).json({ error: "City code is required." });
    }
    if (!cdekConfigured()) {
      return res.status(503).json({ error: "CDEK is not configured." });
    }
    const data = await cdekFetch(`/deliverypoints?country_code=RU&city_code=${cityCode}&type=PVZ`);
    const points = (Array.isArray(data) ? data : []).map((point) => ({
      code: point.code,
      name: point.name,
      address: point.location?.address_full || point.location?.address || point.address || "",
      workTime: point.work_time || ""
    }));
    res.json({ points });
  } catch (error) {
    if (sendCdekClientError(res, error)) {
      return;
    }
    next(error);
  }
});

app.post(["/api/delivery/calculate", "/chat-api/delivery/calculate"], async (req, res, next) => {
  try {
    const settings = storeSettingsPayload();
    if (!settings.deliveryEnabled) {
      return res.json({ delivery: { provider: "none", price: 0 } });
    }
    if (!settings.cdekReady) {
      return res.status(503).json({ error: "CDEK is not configured." });
    }
    const items = normalizeOrderItems(req.body.items);
    if (!items.length) {
      return res.status(400).json({ error: "Cart is empty." });
    }
    const delivery = await calculateCdekDelivery({
      cityCode: req.body.cityCode,
      deliveryPointCode: req.body.deliveryPointCode,
      items
    });
    res.json({ delivery });
  } catch (error) {
    if (sendCdekClientError(res, error)) {
      return;
    }
    next(error);
  }
});

app.post(["/api/admin/delivery/calculate", "/chat-api/admin/delivery/calculate"], requireAdmin, async (req, res, next) => {
  try {
    const settings = storeSettingsPayload({ admin: true });
    if (!settings.cdekReady) {
      return res.status(503).json({ error: "CDEK is not configured." });
    }
    const cityCode = cleanInteger(req.body.cityCode, 0);
    const deliveryPointCode = cleanText(req.body.deliveryPointCode, 80);
    const weight = Math.max(1, cleanInteger(req.body.weightGrams, 100));
    if (!cityCode || !deliveryPointCode) {
      return res.status(400).json({ error: "Выберите город и ПВЗ CDEK." });
    }
    const delivery = await calculateCdekDelivery({
      cityCode,
      deliveryPointCode,
      items: [{ weight }],
      includeDebug: true
    });
    res.json({ delivery, settings, cdekDebug: delivery.debug });
  } catch (error) {
    if (error.cdekDebug) {
      return res.status(502).json({ error: error.message, cdekDebug: error.cdekDebug });
    }
    next(error);
  }
});

app.post(["/api/promocodes/preview", "/chat-api/promocodes/preview"], (req, res) => {
  const items = normalizeOrderItems(req.body.items);
  if (!items.length) {
    return res.status(400).json({ error: "Корзина пуста." });
  }
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const result = resolvePromoCode(req.body.code, subtotal);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  const totals = orderTotals(items, 0, result.promo?.discountAmount || 0);
  return res.json({
    promo: result.promo,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    total: totals.total
  });
});

app.post(["/api/orders", "/chat-api/orders"], async (req, res, next) => {
  try {
    const session = getSession(req);
    const items = normalizeOrderItems(req.body.items);
    if (!items.length) {
      return res.status(400).json({ error: "Cart is empty." });
    }
    const customer = req.body.customer || {};
    const customerName = cleanText(customer.name, 120);
    const customerPhone = cleanText(customer.phone, 40);
    const customerEmail = cleanText(customer.email, 160);
    const customerComment = cleanText(customer.comment, 1000);
    if (!customerName || !customerPhone) {
      return res.status(400).json({ error: "Name and phone are required." });
    }

    const settings = storeSettingsPayload();
    let delivery = { provider: "none", price: 0 };
    if (settings.deliveryEnabled) {
      if (!settings.cdekReady) {
        return res.status(503).json({ error: "CDEK is not configured." });
      }
      delivery = await calculateCdekDelivery({
        cityCode: req.body.delivery?.cityCode,
        deliveryPointCode: req.body.delivery?.deliveryPointCode,
        items
      });
      delivery.cityName = cleanText(req.body.delivery?.cityName, 160);
      delivery.pointName = cleanText(req.body.delivery?.pointName, 220);
      delivery.pointAddress = cleanText(req.body.delivery?.pointAddress, 300);
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const promoResult = resolvePromoCode(req.body.promoCode, subtotal);
    if (!promoResult.ok) {
      return res.status(400).json({ error: promoResult.error });
    }
    const promo = promoResult.promo || null;
    const totals = orderTotals(items, delivery.price, promo?.discountAmount || 0);
    const publicId = `LS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const stamp = nowIso();
    const result = db.prepare(`
      INSERT INTO orders(
        user_id,
        public_id, customer_name, customer_phone, customer_email, customer_comment,
        items_json, delivery_json, subtotal, delivery_price, total, status,
        payment_provider, created_at, updated_at
        , promo_code, promo_discount_amount, promo_details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session?.userId || null,
      publicId,
      customerName,
      customerPhone,
      customerEmail,
      customerComment,
      JSON.stringify(items),
      JSON.stringify(delivery),
      totals.subtotal,
      totals.deliveryPrice,
      totals.total,
      "created",
      "yookassa",
      stamp,
      stamp,
      promo?.code || "",
      totals.discountAmount,
      JSON.stringify(promo || {})
    );

    let order = publicOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(result.lastInsertRowid)));
    if (settings.paymentEnabled) {
      if (!customerEmail) {
        return res.status(400).json({ error: "Email is required for YooKassa receipt." });
      }
      if (!yookassaConfigured()) {
        return res.status(503).json({
          error: "YooKassa is not configured.",
          order,
          paymentRequired: true
        });
      }
      let payment;
      try {
        payment = await createYookassaPayment(order);
      } catch (error) {
        console.error(error);
        return res.status(502).json({
          error: `YooKassa payment error: ${error.message}`,
          order,
          paymentRequired: true
        });
      }
      db.prepare("UPDATE orders SET payment_id = ?, payment_url = ?, payment_status = ?, status = ?, updated_at = ? WHERE id = ?")
        .run(payment.id || "", payment.confirmation?.confirmation_url || "", payment.status || "", "payment_pending", nowIso(), order.id);
      order = publicOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id));
    }

    res.status(201).json({ order, paymentUrl: order.paymentUrl });
  } catch (error) {
    if (sendCdekClientError(res, error)) {
      return;
    }
    next(error);
  }
});

app.post(["/api/yookassa/webhook", "/chat-api/yookassa/webhook"], (req, res) => {
  const event = cleanText(req.body?.event, 120);
  const payment = req.body?.object;
  if (!payment || payment.object !== "payment") {
    return res.status(200).json({ ok: true, ignored: true });
  }
  const order = applyYookassaWebhook(payment);
  return res.status(200).json({
    ok: true,
    event,
    updated: Boolean(order),
    order: order ? {
      id: order.id,
      publicId: order.publicId,
      status: order.status,
      paymentStatus: order.paymentStatus
    } : null
  });
});

app.get(["/api/admin/products", "/chat-api/admin/products"], requireAdmin, (_req, res) => {
  res.json({ products: listProducts({ includeInactive: true }) });
});

app.get(["/api/admin/banners", "/chat-api/admin/banners"], requireAdmin, (_req, res) => {
  res.json({ banners: listCategoryBanners({ includeInactive: true }) });
});


app.get(["/api/admin/store-settings", "/chat-api/admin/store-settings"], requireAdmin, (_req, res) => {
  res.json({ settings: storeSettingsPayload({ admin: true }) });
});

app.patch(["/api/admin/store-settings", "/chat-api/admin/store-settings"], requireAdmin, (req, res) => {
  setSetting("delivery_enabled", boolFromValue(req.body.deliveryEnabled, true) ? "1" : "0");
  setSetting("payment_enabled", boolFromValue(req.body.paymentEnabled, true) ? "1" : "0");
  setSetting("cdek_from_location_code", cleanText(req.body.cdekFromLocationCode, 40));
  setSetting("cdek_sender_point_code", cleanText(req.body.cdekSenderPointCode, 80));
  setSetting("cdek_tariff_code", String(cleanInteger(req.body.cdekTariffCode, DEFAULT_CDEK_TARIFF_CODE)));
  setSetting("cdek_package_length", String(cleanPackageDimension(req.body.cdekPackageLength, DEFAULT_PACKAGE.length)));
  setSetting("cdek_package_width", String(cleanPackageDimension(req.body.cdekPackageWidth, DEFAULT_PACKAGE.width)));
  setSetting("cdek_package_height", String(cleanPackageDimension(req.body.cdekPackageHeight, DEFAULT_PACKAGE.height)));
  res.json({ settings: storeSettingsPayload({ admin: true }) });
});

app.get(["/api/admin/orders", "/chat-api/admin/orders"], requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 100").all();
  res.json({ orders: rows.map(publicOrder) });
});

app.get(["/api/admin/promocodes", "/chat-api/admin/promocodes"], requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM promo_codes ORDER BY updated_at DESC, id DESC").all();
  res.json({ promoCodes: rows.map(publicPromoCode) });
});

app.post(["/api/admin/promocodes", "/chat-api/admin/promocodes"], requireAdmin, (req, res) => {
  const payload = promoCodePayloadFromBody(req.body);
  if (!payload.code) {
    return res.status(400).json({ error: "Код промокода обязателен." });
  }
  if (!payload.discountValue) {
    return res.status(400).json({ error: "Укажите размер скидки." });
  }
  const existing = getPromoCodeByCode(payload.code);
  if (existing) {
    return res.status(400).json({ error: "Промокод с таким кодом уже существует." });
  }
  const stamp = nowIso();
  const result = db.prepare(`
    INSERT INTO promo_codes(
      code, description, discount_kind, discount_value, max_uses,
      starts_at, ends_at, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.code,
    payload.description,
    payload.discountKind,
    payload.discountValue,
    payload.maxUses,
    payload.startsAt,
    payload.endsAt,
    payload.isActive ? 1 : 0,
    stamp,
    stamp
  );
  res.status(201).json({ promoCode: publicPromoCode(db.prepare("SELECT * FROM promo_codes WHERE id = ?").get(Number(result.lastInsertRowid))) });
});

app.patch(["/api/admin/promocodes/:promoCodeId", "/chat-api/admin/promocodes/:promoCodeId"], requireAdmin, (req, res) => {
  const promoCodeId = Number(req.params.promoCodeId);
  const existing = getPromoCodeById(promoCodeId);
  if (!existing) {
    return res.status(404).json({ error: "Промокод не найден." });
  }
  const payload = promoCodePayloadFromBody(req.body, existing);
  if (!payload.code) {
    return res.status(400).json({ error: "Код промокода обязателен." });
  }
  if (!payload.discountValue) {
    return res.status(400).json({ error: "Укажите размер скидки." });
  }
  const duplicate = getPromoCodeByCode(payload.code);
  if (duplicate && Number(duplicate.id) !== promoCodeId) {
    return res.status(400).json({ error: "Промокод с таким кодом уже существует." });
  }
  db.prepare(`
    UPDATE promo_codes
    SET code = ?, description = ?, discount_kind = ?, discount_value = ?, max_uses = ?,
        starts_at = ?, ends_at = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    payload.code,
    payload.description,
    payload.discountKind,
    payload.discountValue,
    payload.maxUses,
    payload.startsAt,
    payload.endsAt,
    payload.isActive ? 1 : 0,
    nowIso(),
    promoCodeId
  );
  res.json({ promoCode: publicPromoCode(db.prepare("SELECT * FROM promo_codes WHERE id = ?").get(promoCodeId)) });
});

app.delete(["/api/admin/promocodes/:promoCodeId", "/chat-api/admin/promocodes/:promoCodeId"], requireAdmin, (req, res) => {
  const promoCodeId = Number(req.params.promoCodeId);
  const existing = getPromoCodeById(promoCodeId);
  if (!existing) {
    return res.status(404).json({ error: "Промокод не найден." });
  }
  db.prepare("DELETE FROM promo_codes WHERE id = ?").run(promoCodeId);
  res.json({ ok: true, promoCodeId });
});

app.post(["/api/admin/banners", "/chat-api/admin/banners"], requireAdmin, (req, res) => {
  const payload = categoryBannerPayloadFromBody(req.body);
  if (!payload.category) {
    return res.status(400).json({ error: "Категория обязательна." });
  }
  if (getCategoryBannerByKey(payload.categoryKey)) {
    return res.status(400).json({ error: "Баннер для этой категории уже существует." });
  }
  const stamp = nowIso();
  const result = db.prepare(`
    INSERT INTO category_banners(
      title, category, category_key, image_url, alt_text, is_active, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.title,
    payload.category,
    payload.categoryKey,
    payload.imageUrl,
    payload.altText,
    payload.isActive,
    payload.sortOrder,
    stamp,
    stamp
  );
  res.status(201).json({ banner: getCategoryBanner(Number(result.lastInsertRowid)) });
});

app.patch(["/api/admin/banners/:bannerId", "/chat-api/admin/banners/:bannerId"], requireAdmin, (req, res) => {
  const bannerId = Number(req.params.bannerId);
  const existing = getCategoryBanner(bannerId);
  if (!existing) {
    return res.status(404).json({ error: "Баннер не найден." });
  }
  const payload = categoryBannerPayloadFromBody(req.body, existing);
  if (!payload.category) {
    return res.status(400).json({ error: "Категория обязательна." });
  }
  const duplicate = getCategoryBannerByKey(payload.categoryKey);
  if (duplicate && Number(duplicate.id) !== bannerId) {
    return res.status(400).json({ error: "Баннер для этой категории уже существует." });
  }
  db.prepare(`
    UPDATE category_banners
    SET title = ?, category = ?, category_key = ?, image_url = ?, alt_text = ?,
        is_active = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).run(
    payload.title,
    payload.category,
    payload.categoryKey,
    payload.imageUrl,
    payload.altText,
    payload.isActive,
    payload.sortOrder,
    nowIso(),
    bannerId
  );
  res.json({ banner: getCategoryBanner(bannerId) });
});

app.delete(["/api/admin/banners/:bannerId", "/chat-api/admin/banners/:bannerId"], requireAdmin, (req, res) => {
  const bannerId = Number(req.params.bannerId);
  const existing = getCategoryBanner(bannerId);
  if (!existing) {
    return res.status(404).json({ error: "Баннер не найден." });
  }
  db.prepare("DELETE FROM category_banners WHERE id = ?").run(bannerId);
  res.json({ ok: true, bannerId });
});

app.post(["/api/admin/banners/:bannerId/image", "/chat-api/admin/banners/:bannerId/image"], requireAdmin, productImageUpload.single("image"), (req, res) => {
  const bannerId = Number(req.params.bannerId);
  const existing = getCategoryBanner(bannerId);
  if (!existing) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(404).json({ error: "Баннер не найден." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Изображение обязательно." });
  }

  const imageUrl = `/product-images/${path.basename(req.file.path)}`;
  db.prepare("UPDATE category_banners SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, nowIso(), bannerId);
  res.json({ banner: getCategoryBanner(bannerId) });
});

app.post(["/api/admin/products", "/chat-api/admin/products"], requireAdmin, (req, res) => {
  const payload = productPayloadFromBody(req.body);
  if (!payload.title) {
    return res.status(400).json({ error: "Title is required." });
  }

  const stamp = nowIso();
  const result = db.prepare(`
    INSERT INTO products(
      slug, title, subtitle, category, short_description, description, benefits_json,
      dosage, composition, notice, image_url, price, discount_percent, unit, price_options_json,
      package_length, package_width, package_height, is_active, sort_order,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.slug,
    payload.title,
    payload.subtitle,
    payload.category,
    payload.shortDescription,
    payload.description,
    payload.benefitsJson,
    payload.dosage,
    payload.composition,
    payload.notice,
    payload.imageUrl,
    payload.price,
    payload.discountPercent,
    payload.unit,
    payload.priceOptionsJson,
    payload.packageLength,
    payload.packageWidth,
    payload.packageHeight,
    payload.isActive,
    payload.sortOrder,
    stamp,
    stamp
  );

  res.status(201).json({ product: getProduct(Number(result.lastInsertRowid)) });
});

app.patch(["/api/admin/products/:productId", "/chat-api/admin/products/:productId"], requireAdmin, (req, res) => {
  const productId = Number(req.params.productId);
  const existing = getProduct(productId);
  if (!existing) {
    return res.status(404).json({ error: "Product not found." });
  }

  const payload = productPayloadFromBody(req.body, existing);
  if (!payload.title) {
    return res.status(400).json({ error: "Title is required." });
  }

  db.prepare(`
    UPDATE products
    SET
      slug = ?,
      title = ?,
      subtitle = ?,
      category = ?,
      short_description = ?,
      description = ?,
      benefits_json = ?,
      dosage = ?,
      composition = ?,
      notice = ?,
      image_url = ?,
      price = ?,
      discount_percent = ?,
      unit = ?,
      price_options_json = ?,
      package_length = ?,
      package_width = ?,
      package_height = ?,
      is_active = ?,
      sort_order = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    payload.slug,
    payload.title,
    payload.subtitle,
    payload.category,
    payload.shortDescription,
    payload.description,
    payload.benefitsJson,
    payload.dosage,
    payload.composition,
    payload.notice,
    payload.imageUrl,
    payload.price,
    payload.discountPercent,
    payload.unit,
    payload.priceOptionsJson,
    payload.packageLength,
    payload.packageWidth,
    payload.packageHeight,
    payload.isActive,
    payload.sortOrder,
    nowIso(),
    productId
  );

  res.json({ product: getProduct(productId) });
});

app.delete(["/api/admin/products/:productId", "/chat-api/admin/products/:productId"], requireAdmin, (req, res) => {
  const productId = Number(req.params.productId);
  const existing = getProduct(productId);
  if (!existing) {
    return res.status(404).json({ error: "Product not found." });
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(productId);
  res.json({ ok: true, productId });
});

app.post(["/api/admin/products/:productId/image", "/chat-api/admin/products/:productId/image"], requireAdmin, productImageUpload.single("image"), (req, res) => {
  const productId = Number(req.params.productId);
  const existing = getProduct(productId);
  if (!existing) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(404).json({ error: "Product not found." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required." });
  }

  const imageUrl = `/product-images/${path.basename(req.file.path)}`;
  db.prepare("UPDATE products SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, nowIso(), productId);
  res.json({ product: getProduct(productId) });
});

app.get("/chat-api/me", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    ...authPayload(session.userId)
  });
});

app.post("/chat-api/auth/register", async (req, res) => {
  const username = cleanText(req.body.username, 32).toLowerCase();
  const password = String(req.body.password || "");
  const displayName = cleanText(req.body.displayName, 48) || username;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: "Логин должен быть 3-24 символа: латиница, цифры и _." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Пароль должен быть не короче 6 символов." });
  }
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: "Такой логин уже занят." });
  }

  const stamp = nowIso();
  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare(`
    INSERT INTO users(username, password_hash, display_name, bio, location, created_at, last_login_at, last_seen_at)
    VALUES (?, ?, ?, '', '', ?, ?, ?)
  `).run(username, hash, displayName, stamp, stamp, stamp);

  const userId = Number(result.lastInsertRowid);
  ensureDefaultChannels();
  const general = db.prepare("SELECT id FROM channels WHERE kind = 'public' ORDER BY id ASC LIMIT 1").get();
  if (general) {
    ensureChannelMembership(general.id, userId);
  }
  ensurePersonalChannel(userId, displayName);

  const sessionId = createSession(userId);
  issueSessionCookie(req, res, sessionId);
  res.status(201).json(authPayload(userId));
});

app.post("/chat-api/auth/login", async (req, res) => {
  const username = cleanText(req.body.username, 32).toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Неверный логин или пароль." });
  }

  const stamp = nowIso();
  db.prepare("UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?").run(stamp, stamp, user.id);
  ensureDefaultChannels();
  ensurePersonalChannel(user.id, user.display_name);

  const sessionId = createSession(user.id);
  issueSessionCookie(req, res, sessionId);
  res.json(authPayload(user.id));
});

app.post("/chat-api/auth/logout", requireAuth, (req, res) => {
  const sessionId = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (sessionId) {
    deleteSession(sessionId);
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get("/chat-api/push/public-key", requireAuth, (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post("/chat-api/push/subscriptions", requireAuth, (req, res) => {
  const subscription = normalizePushSubscription(req.body);
  if (!subscription) {
    return res.status(400).json({ error: "Некорректная push-подписка." });
  }
  savePushSubscription(req.user.id, subscription);
  res.status(201).json({ ok: true });
});

app.delete("/chat-api/push/subscriptions", requireAuth, (req, res) => {
  const endpoint = String(req.body?.endpoint || "").trim();
  if (endpoint) {
    deletePushSubscription(endpoint);
  }
  res.json({ ok: true });
});

app.get("/chat-api/channels", requireAuth, (req, res) => {
  res.json({ channels: listChannels(req.user.id, req.query.q || "") });
});

app.post("/chat-api/channels", requireAuth, (req, res) => {
  const name = cleanText(req.body.name, 80);
  const description = cleanText(req.body.description, 280);
  if (name.length < 3) {
    return res.status(400).json({ error: "Название канала должно быть не короче 3 символов." });
  }
  const channel = createChannel({
    name,
    description,
    ownerUserId: req.user.id,
    kind: req.body.kind === "personal" ? "personal" : "public"
  });
  res.status(201).json({ channel, channels: listChannels(req.user.id) });
});

app.patch("/chat-api/channels/:channelId", requireAuth, (req, res) => {
  const channelId = Number(req.params.channelId);
  const channel = db.prepare("SELECT * FROM channels WHERE id = ?").get(channelId);
  if (!channel) {
    return res.status(404).json({ error: "Канал не найден." });
  }
  if (channel.owner_user_id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ error: "Редактировать канал может только владелец или администратор." });
  }

  db.prepare(`
    UPDATE channels
    SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(
    cleanText(req.body.name, 80) || channel.name,
    cleanText(req.body.description, 280),
    nowIso(),
    channelId
  );

  const updated = getChannelSummary(channelId, req.user.id);
  broadcastToChannel(channelId, { type: "channelUpdated", channel: updated });
  res.json({ channel: updated, channels: listChannels(req.user.id) });
});

app.delete("/chat-api/channels/:channelId", requireAuth, (req, res) => {
  const channelId = Number(req.params.channelId);
  const channel = db.prepare("SELECT * FROM channels WHERE id = ?").get(channelId);
  if (!channel) {
    return res.status(404).json({ error: "Канал не найден." });
  }
  if (channel.owner_user_id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ error: "Удалять канал может только владелец или администратор." });
  }

  const result = deleteChannelAndBroadcast(channelId, req.user);
  res.json({
    ok: true,
    channelId,
    channels: result?.channels || []
  });
});

app.post("/chat-api/channels/:channelId/join", requireAuth, (req, res) => {
  const channelId = Number(req.params.channelId);
  const channel = getChannelSummary(channelId, req.user.id);
  if (!channel) {
    return res.status(404).json({ error: "Канал не найден." });
  }
  ensureChannelMembership(channelId, req.user.id);
  markChannelActivity(channelId, req.user.id);
  res.json({ channel: getChannelSummary(channelId, req.user.id) });
});

app.get("/chat-api/channels/:channelId", requireAuth, (req, res) => {
  const channel = getChannelWithAutoJoin(Number(req.params.channelId), req.user.id);
  if (!channel) {
    return res.status(404).json({ error: "Канал не найден." });
  }
  res.json({
    channel,
    users: listChannelUsers(channel.id)
  });
});

app.get("/chat-api/channels/:channelId/messages", requireAuth, (req, res) => {
  const channel = getChannelWithAutoJoin(Number(req.params.channelId), req.user.id);
  if (!channel) {
    return res.status(404).json({ error: "Канал не найден." });
  }
  res.json({
    channel,
    messages: enrichMessages(listChannelMessages(channel.id), req.user)
  });
});

app.get("/chat-api/channels/:channelId/users", requireAuth, (req, res) => {
  const channel = getChannelWithAutoJoin(Number(req.params.channelId), req.user.id);
  if (!channel) {
    return res.status(404).json({ error: "Канал не найден." });
  }
  res.json({
    channel,
    users: listChannelUsers(channel.id),
    stats: getChannelStats(channel.id)
  });
});

app.post("/chat-api/channels/:channelId/messages", requireAuth, upload.single("file"), (req, res) => {
  const channel = getChannelWithAutoJoin(Number(req.params.channelId), req.user.id);
  if (!channel) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(404).json({ error: "Канал не найден." });
  }

  const content = cleanText(req.body.content, 5000);
  if (!content && !req.file) {
    return res.status(400).json({ error: "Сообщение пустое." });
  }

  const stamp = nowIso();
  const attachmentUrl = req.file ? `/chat-uploads/${path.basename(req.file.path)}` : null;
  const attachmentName = req.file ? req.file.originalname : null;
  const attachmentType = req.file ? req.file.mimetype : null;
  const attachmentSize = req.file ? req.file.size : null;

  const result = db.prepare(`
    INSERT INTO messages(channel_id, user_id, content, attachment_url, attachment_name, attachment_type, attachment_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(channel.id, req.user.id, content, attachmentUrl, attachmentName, attachmentType, attachmentSize, stamp);

  db.prepare("UPDATE channels SET updated_at = ? WHERE id = ?").run(stamp, channel.id);
  markChannelActivity(channel.id, req.user.id);

  const message = db.prepare(`
    SELECT
      m.id,
      m.channel_id AS channelId,
      m.content,
      m.attachment_url AS attachmentUrl,
      m.attachment_name AS attachmentName,
      m.attachment_type AS attachmentType,
      m.attachment_size AS attachmentSize,
      m.created_at AS createdAt,
      u.id AS userId,
      u.username,
      u.display_name AS displayName
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(Number(result.lastInsertRowid));

  const payload = withMessagePermissions(message, req.user);
  payload.reactions = [];
  const channelSummary = getChannelSummary(channel.id, req.user.id);
  broadcastToChannel(channel.id, {
    type: "messageCreated",
    message: payload,
    channel: channelSummary
  });
  sendChannelMessagePush(channelSummary, payload, req.user);
  broadcastPresence(channel.id);

  res.status(201).json({
    message: payload,
    channel: channelSummary
  });
});

app.delete("/chat-api/messages/:messageId", requireAuth, (req, res) => {
  const message = db.prepare(`
    SELECT
      id,
      channel_id AS channelId,
      user_id AS userId,
      attachment_url AS attachmentUrl
    FROM messages
    WHERE id = ?
  `).get(Number(req.params.messageId));

  if (!message) {
    return res.status(404).json({ error: "Сообщение не найдено." });
  }
  if (message.userId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ error: "Удалять можно только свои сообщения или администратору." });
  }

  const channel = deleteMessageAndBroadcast(message, req.user);
  res.json({ ok: true, messageId: message.id, channel });
});

app.post("/chat-api/messages/:messageId/reactions", requireAuth, (req, res, next) => {
  try {
    const result = toggleMessageReaction(Number(req.params.messageId), req.body.emoji, req.user);
    res.json({
      ok: true,
      messageId: result.messageId,
      reactions: result.reactions,
      channel: result.channel
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
});

app.get("/chat-api/users/:userId", requireAuth, (req, res) => {
  const user = publicUserProfile(Number(req.params.userId));
  if (!user) {
    return res.status(404).json({ error: "Пользователь не найден." });
  }
  res.json({ user });
});

app.patch("/chat-api/me/profile", requireAuth, (req, res) => {
  db.prepare(`
    UPDATE users
    SET display_name = ?, bio = ?, location = ?, last_seen_at = ?
    WHERE id = ?
  `).run(
    cleanText(req.body.displayName, 48) || req.user.displayName,
    cleanText(req.body.bio, 280),
    cleanText(req.body.location, 80),
    nowIso(),
    req.user.id
  );

  res.json({
    user: publicUserProfile(req.user.id),
    channels: listChannels(req.user.id)
  });
});

app.post("/chat-api/me/avatar", requireAuth, avatarUpload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Avatar image is required." });
  }

  const current = publicUserProfile(req.user.id);
  const nextAvatarUrl = `${PROFILE_AVATAR_PREFIX}${path.basename(req.file.path)}`;
  db.prepare("UPDATE users SET avatar_url = ?, last_seen_at = ? WHERE id = ?")
    .run(nextAvatarUrl, nowIso(), req.user.id);

  if (current?.avatarUrl && current.avatarUrl.startsWith(PROFILE_AVATAR_PREFIX)) {
    const currentFilePath = path.join(UPLOAD_DIR, path.basename(current.avatarUrl));
    if (currentFilePath !== req.file.path) {
      fs.unlink(currentFilePath, () => {});
    }
  }

  res.json({
    user: publicUserProfile(req.user.id),
    channels: listChannels(req.user.id)
  });
});

app.get("/chat-api/me/orders", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT *
    FROM orders
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 100
  `).all(req.user.id);
  res.json({ orders: rows.map(publicOrder) });
});

app.get("/chat-api/admin/overview", requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name AS displayName,
      u.created_at AS createdAt,
      u.last_login_at AS lastLoginAt,
      u.last_seen_at AS lastSeenAt,
      (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS messageCount,
      (SELECT COUNT(*) FROM channels c WHERE c.owner_user_id = u.id) AS createdChannelsCount
    FROM users u
    ORDER BY u.last_seen_at DESC
    LIMIT 100
  `).all().map((user) => ({
    ...user,
    isAdmin: isAdminUser(user)
  }));

  const channels = db.prepare(`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.kind,
      c.description,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      u.display_name AS ownerDisplayName,
      (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messageCount,
      (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS memberCount,
      (SELECT COUNT(*) FROM channel_visits cv WHERE cv.channel_id = c.id) AS visitorCount
    FROM channels c
    JOIN users u ON u.id = c.owner_user_id
    ORDER BY c.updated_at DESC
    LIMIT 100
  `).all().map((channel) => ({
    ...channel,
    stats: getChannelStats(channel.id)
  }));

  const recentMessages = enrichMessages(db.prepare(`
    SELECT
      m.id,
      m.channel_id AS channelId,
      c.name AS channelName,
      m.content,
      m.attachment_url AS attachmentUrl,
      m.attachment_name AS attachmentName,
      m.attachment_type AS attachmentType,
      m.attachment_size AS attachmentSize,
      m.created_at AS createdAt,
      u.id AS userId,
      u.username,
      u.display_name AS displayName
    FROM messages m
    JOIN users u ON u.id = m.user_id
    JOIN channels c ON c.id = m.channel_id
    ORDER BY m.id DESC
    LIMIT 200
  `).all(), req.user);

  res.json({
    admin: publicUserProfile(req.user.id),
    stats: {
      userCount: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
      channelCount: db.prepare("SELECT COUNT(*) AS count FROM channels").get().count,
      messageCount: db.prepare("SELECT COUNT(*) AS count FROM messages").get().count,
      attachmentCount: db.prepare("SELECT COUNT(*) AS count FROM messages WHERE attachment_url IS NOT NULL").get().count
    },
    users,
    channels,
    recentMessages
  });
});

app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Файл слишком большой. Лимит 5 МБ." });
  }
  if (err?.code === "EACCES" || err?.code === "EPERM") {
    console.error(err);
    return res.status(500).json({ error: "Сервер не может сохранить файл. Проверьте права на папку загрузки." });
  }
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера." });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith("/chat-ws")) {
    socket.destroy();
    return;
  }

  const session = getSession(req);
  if (!session) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.userId = session.userId;
    ws.channelId = null;
    wss.emit("connection", ws);
  });
});

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({
    type: "hello",
    user: publicUserProfile(ws.userId)
  }));

  ws.on("message", (raw) => {
    let payload;
    try {
      payload = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (payload.type === "subscribe" && Number.isFinite(Number(payload.channelId))) {
      const channelId = Number(payload.channelId);
      ensureChannelMembership(channelId, ws.userId);
      markChannelActivity(channelId, ws.userId);
      subscribeSocket(ws, channelId);
      ws.send(JSON.stringify({
        type: "presence",
        users: getOnlineUsers(channelId),
        stats: getChannelStats(channelId)
      }));
      return;
    }

    if (payload.type === "unsubscribe") {
      unsubscribeSocket(ws);
    }
  });

  ws.on("close", () => {
    unsubscribeSocket(ws);
  });
});

ensureDefaultChannels();
ensureStoreSettings();
ensureDefaultProducts();
ensureGrainMyceliumPrices();
ensureCuratedCatalogProducts();
ensureDefaultCategoryBanners();

server.listen(PORT, () => {
  console.log(`Shamanchik chat server listening on ${PORT}`);
});
