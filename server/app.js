const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");
const { WebSocketServer, WebSocket } = require("ws");

const ROOT_DIR = path.resolve(__dirname, "..");
const CHAT_DIR = path.join(ROOT_DIR, "chat");
const STORAGE_DIR = process.env.CHAT_STORAGE_DIR || path.join(ROOT_DIR, "storage");
const DB_PATH = process.env.CHAT_DB_PATH || path.join(STORAGE_DIR, "chat.sqlite");
const UPLOAD_DIR = process.env.CHAT_UPLOAD_DIR || path.join(STORAGE_DIR, "uploads");
const PORT = Number(process.env.PORT || 3210);
const SESSION_COOKIE = "shamanchik_chat_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ADMIN_USERNAMES = new Set([
  "wizardjiocb",
  "shamanchik008"
]);

fs.mkdirSync(STORAGE_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

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
  const needle = `%${cleanText(search, 80).toLowerCase()}%`;
  return db.prepare(`
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
    WHERE LOWER(c.name) LIKE ? OR LOWER(c.description) LIKE ? OR LOWER(u.display_name) LIKE ?
    ORDER BY
      CASE
        WHEN c.owner_user_id = ? THEN 0
        WHEN EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) THEN 1
        ELSE 2
      END,
      c.updated_at DESC
  `).all(currentUserId, needle, needle, needle, currentUserId, currentUserId).map((channel) => ({
    ...channel,
    stats: getChannelStats(channel.id)
  }));
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
    canDelete: Boolean(viewer && (viewer.id === message.userId || isAdminUser(viewer)))
  };
}

function enrichMessages(messages, viewer) {
  return messages.map((message) => withMessagePermissions(message, viewer));
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

app.use("/chat-assets", express.static(CHAT_DIR));
app.use("/chat-uploads", express.static(UPLOAD_DIR));

app.get(["/chat", "/chat/"], (_req, res) => {
  res.sendFile(path.join(CHAT_DIR, "index.html"));
});

app.get(["/chat/admin", "/chat/admin/"], (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.redirect("/chat");
  }
  if (!session.isAdmin) {
    return res.status(403).type("text/plain; charset=utf-8").send("Доступ только для администратора.");
  }
  return res.sendFile(path.join(CHAT_DIR, "admin.html"));
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
  const channelSummary = getChannelSummary(channel.id, req.user.id);
  broadcastToChannel(channel.id, {
    type: "messageCreated",
    message: payload,
    channel: channelSummary
  });
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

server.listen(PORT, () => {
  console.log(`Shamanchik chat server listening on ${PORT}`);
});
