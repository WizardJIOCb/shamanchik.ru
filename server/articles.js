const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");

const VISITOR_COOKIE = "shamanchik_article_visitor";
const MAX_ARTICLE_FILE_SIZE = 50 * 1024 * 1024;
const CONTENT_REACTIONS = ["heart", "useful", "fire", "support", "insight"];
const DEFAULT_SECTIONS = [
  {
    slug: "praktiki-i-znaniya",
    title: "Практики и знания",
    description: "Главный раздел с практиками, знаниями и полезными материалами.",
    parentSlug: null,
    sortOrder: 10
  },
  {
    slug: "stati",
    title: "Статьи",
    description: "Авторские статьи, блоги и обзоры.",
    parentSlug: null,
    sortOrder: 20
  },
  {
    slug: "praktiki",
    title: "Практики",
    description: "Практические материалы, ритуалы и последовательности действий.",
    parentSlug: "praktiki-i-znaniya",
    sortOrder: 11
  },
  {
    slug: "znaniya",
    title: "Знания",
    description: "База знаний, объяснения и разборы.",
    parentSlug: "praktiki-i-znaniya",
    sortOrder: 12
  },
  {
    slug: "blogi-i-istorii",
    title: "Блоги и истории",
    description: "Личные заметки, истории и впечатления.",
    parentSlug: "stati",
    sortOrder: 21
  },
  {
    slug: "obzory-i-gidy",
    title: "Обзоры и гиды",
    description: "Подборки, гиды и обзоры материалов.",
    parentSlug: "stati",
    sortOrder: 22
  }
];
const DEFAULT_ARTICLES = [
  {
    sectionSlug: "praktiki",
    type: "practice",
    slug: "utrennyaya-praktika-sborki-vnimaniya",
    title: "Утренняя практика сборки внимания",
    excerpt: "Мягкий 12-минутный ритуал, который помогает войти в день спокойно, почувствовать тело и вернуть фокус.",
    coverImageUrl: "/images/index2-hero.png",
    seoTitle: "Утренняя практика сборки внимания",
    seoDescription: "Короткая утренняя практика дыхания, внимания и телесной настройки перед началом дня.",
    contentHtml: `
      <h2>Зачем нужна эта практика</h2>
      <p>Утром сознание ещё пластично. В первые минуты после пробуждения легче задать тон всему дню: не разбрасываться, не проваливаться в тревогу и не отдавать внимание хаосу.</p>
      <blockquote>Практика не требует особых условий. Достаточно тишины, нескольких минут и готовности быть с собой честно.</blockquote>
      <h2>Последовательность</h2>
      <ol>
        <li><strong>Сядьте ровно.</strong> Поставьте стопы на пол и почувствуйте опору.</li>
        <li><strong>Сделайте 9 спокойных вдохов и выдохов.</strong> Не форсируйте дыхание, только наблюдайте его.</li>
        <li><strong>Переведите внимание в тело.</strong> Заметьте лоб, грудь, живот, ладони, стопы.</li>
        <li><strong>Спросите себя:</strong> что сейчас во мне главное и каким качеством я хочу наполнить день.</li>
      </ol>
      <h2>После практики</h2>
      <p>Запишите одну простую опору на день: слово, образ, обещание себе. Это может быть спокойствие, ясность, устойчивость или доброта к себе.</p>
    `
  },
  {
    sectionSlug: "praktiki",
    type: "practice",
    slug: "dyhanie-dlya-snyatiya-vnutrennego-shuma",
    title: "Дыхание для снятия внутреннего шума",
    excerpt: "Практика для моментов, когда мыслей слишком много, а тело уже реагирует напряжением и раздражением.",
    coverImageUrl: "/images/background.jpg",
    seoTitle: "Дыхание для снятия внутреннего шума",
    seoDescription: "Простая дыхательная практика, чтобы быстро снизить уровень внутреннего напряжения.",
    contentHtml: `
      <h2>Когда использовать</h2>
      <p>Когда вас захлёстывает поток мыслей, появляется ощущение перегруза, а внимание скачет между задачами и тревогами.</p>
      <h2>Как делать</h2>
      <ul>
        <li>Вдох на 4 счёта.</li>
        <li>Пауза на 2 счёта.</li>
        <li>Медленный выдох на 6 счётов.</li>
        <li>Повторить 7 циклов подряд.</li>
      </ul>
      <p>Во время выдоха представляйте, что уходит не воздух, а лишний шум, внутренние спазмы и ненужные мысли.</p>
      <h2>Важно</h2>
      <p>Если кружится голова, уменьшите глубину дыхания. Здесь важна не сила, а ритм и мягкость.</p>
    `
  },
  {
    sectionSlug: "znaniya",
    type: "knowledge",
    slug: "kak-rabotat-s-sostoyaniem-a-ne-borotsya-s-soboy",
    title: "Как работать с состоянием, а не бороться с собой",
    excerpt: "Разбор подхода, при котором мы перестаём давить на себя и начинаем слышать, что именно пытается показать состояние.",
    coverImageUrl: "/images/main-block-reference.png",
    seoTitle: "Как работать с состоянием, а не бороться с собой",
    seoDescription: "Практичный текст о том, как замечать состояние, читать его сигналы и не тратить силы на внутреннюю борьбу.",
    contentHtml: `
      <h2>Состояние — это сообщение</h2>
      <p>Часто человек видит только внешнюю форму: тревога, злость, апатия, усталость. Но за каждой из них скрывается попытка психики и тела что-то сообщить.</p>
      <p>Если сразу включать борьбу, сообщение теряется. Остаётся только сопротивление и истощение.</p>
      <h2>Полезные вопросы</h2>
      <ul>
        <li>Что именно я сейчас чувствую в теле?</li>
        <li>Чего я пытаюсь избежать?</li>
        <li>В чём моя текущая перегрузка?</li>
        <li>Какая минимальная поддержка мне нужна прямо сейчас?</li>
      </ul>
      <h2>Практический вывод</h2>
      <p>Работа с состоянием начинается не с исправления себя, а с контакта. Только после контакта появляются точные действия.</p>
    `
  },
  {
    sectionSlug: "blogi-i-istorii",
    type: "blog",
    slug: "pochemu-ya-sozdal-razdel-praktik-i-statey",
    title: "Почему я создал раздел практик и статей",
    excerpt: "Личная заметка о том, зачем библиотека знаний нужна сообществу и почему важно делиться не только товарами, но и опытом.",
    coverImageUrl: "/images/main-block-and-items+gallery.jpg",
    seoTitle: "Почему я создал раздел практик и статей",
    seoDescription: "Личная история о создании библиотеки практик, знаний и статей для сообщества Лавки Шамана.",
    contentHtml: `
      <h2>Не только продукты, но и путь</h2>
      <p>Со временем стало ясно: людям нужна не просто карточка товара. Им нужен контекст, объяснение, ритуал применения, опыт других и чувство, что они идут не в одиночку.</p>
      <h2>Зачем нужен этот раздел</h2>
      <p>Здесь можно собирать наблюдения, делиться практиками, публиковать заметки и сохранять то, что обычно теряется в чатах и голосовых сообщениях.</p>
      <p>Хочется, чтобы библиотека жила не как витрина, а как живое пространство с материалами, вопросами и комментариями.</p>
    `
  },
  {
    sectionSlug: "obzory-i-gidy",
    type: "guide",
    slug: "kak-vybirat-materialy-dlya-lichnoy-praktiki",
    title: "Как выбирать материалы для личной практики",
    excerpt: "Короткий гид по выбору материалов, когда вы только начинаете и хотите двигаться бережно, без перегруза.",
    coverImageUrl: "/images/banner2.jpg",
    seoTitle: "Как выбирать материалы для личной практики",
    seoDescription: "Гид по выбору подходящих материалов и форматов практики для спокойного и осознанного старта.",
    contentHtml: `
      <h2>Начинайте с запроса, а не с количества</h2>
      <p>Сначала ответьте себе, чего вы хотите больше всего: ясности, восстановления, устойчивости, энергии, сна, дисциплины или тишины.</p>
      <h2>Три опоры выбора</h2>
      <ol>
        <li>Ваше текущее состояние.</li>
        <li>Сколько ресурса у вас реально есть на практику.</li>
        <li>Насколько выбранный формат вписывается в жизнь, а не ломает её.</li>
      </ol>
      <h2>Хороший старт</h2>
      <p>Один материал для чтения, одна короткая практика и одна точка наблюдения за собой на неделю. Этого достаточно, чтобы увидеть первые изменения.</p>
    `
  }
];

function registerArticlesModule(config) {
  const {
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
  } = config;

  const KNOWLEDGE_DIR = path.join(ROOT_DIR, "knowledge");
  const ARTICLE_UPLOAD_DIR = path.join(STORAGE_DIR, "article-uploads");
  fs.mkdirSync(ARTICLE_UPLOAD_DIR, { recursive: true });

  db.exec(`
    CREATE TABLE IF NOT EXISTS article_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES article_sections(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER,
      author_user_id INTEGER NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      cover_image_url TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'article',
      status TEXT NOT NULL DEFAULT 'draft',
      content_html TEXT NOT NULL DEFAULT '',
      content_text TEXT NOT NULL DEFAULT '',
      seo_title TEXT NOT NULL DEFAULT '',
      seo_description TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES article_sections(id) ON DELETE SET NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      uploader_user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_kind TEXT NOT NULL DEFAULT 'file',
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      user_id INTEGER,
      visitor_token TEXT NOT NULL,
      view_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(article_id, user_id, view_date),
      UNIQUE(article_id, visitor_token, view_date),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(article_id, user_id, reaction),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      parent_comment_id INTEGER,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES article_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_comment_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(comment_id, user_id, reaction),
      FOREIGN KEY (comment_id) REFERENCES article_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedDefaultSections();
  ensureDefaultArticles();

  const articleUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ARTICLE_UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const safeBase = String(file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
        const ext = path.extname(safeBase).slice(0, 12) || "";
        const name = path.basename(safeBase, ext).slice(0, 60) || "article";
        cb(null, `${Date.now()}-${crypto.randomUUID()}-${name}${ext}`);
      }
    }),
    limits: { fileSize: MAX_ARTICLE_FILE_SIZE }
  });

  app.use("/article-uploads", require("express").static(ARTICLE_UPLOAD_DIR));

  app.get(["/knowledge", "/knowledge/"], (_req, res) => {
    res.sendFile(path.join(KNOWLEDGE_DIR, "index.html"));
  });

  app.get(["/articles", "/articles/"], (_req, res) => {
    res.redirect("/knowledge");
  });

  app.get(["/knowledge/compose", "/knowledge/compose/"], (_req, res) => {
    res.sendFile(path.join(KNOWLEDGE_DIR, "compose.html"));
  });

  app.get("/knowledge/:slug", (_req, res) => {
    res.sendFile(path.join(KNOWLEDGE_DIR, "article.html"));
  });

  app.get(["/api/knowledge/sections", "/chat-api/knowledge/sections"], (_req, res) => {
    res.json({ sections: listSectionsTree() });
  });

  app.get(["/api/knowledge/articles", "/chat-api/knowledge/articles"], (req, res) => {
    const viewer = getSession(req);
    const includeOwnDrafts = req.query.mine === "1" && viewer;
    res.json({
      articles: listArticles({
        viewer,
        sectionSlug: cleanText(req.query.section, 80),
        q: cleanText(req.query.q, 100),
        type: cleanText(req.query.type, 40),
        includeOwnDrafts
      })
    });
  });

  app.get(["/api/knowledge/articles/:slug", "/chat-api/knowledge/articles/:slug"], (req, res) => {
    const viewer = getSession(req);
    const article = getArticleBySlug(cleanText(req.params.slug, 120), viewer);
    if (!article || (!article.isPublished && !canViewPrivateArticle(article, viewer))) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    return res.json({ article: withArticleDetails(article, viewer) });
  });

  app.post(["/api/knowledge/articles/:articleId/view", "/chat-api/knowledge/articles/:articleId/view"], (req, res) => {
    const articleId = Number(req.params.articleId);
    const article = getArticleById(articleId, null);
    if (!article || !article.isPublished) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    registerArticleView(articleId, req, res);
    return res.json({ ok: true, viewsCount: countArticleViews(articleId) });
  });

  app.get("/chat-api/knowledge/articles/mine", requireAuth, (req, res) => {
    res.json({
      articles: listArticles({
        viewer: req.user,
        authorUserId: req.user.id,
        includeAllStatuses: true
      })
    });
  });

  app.get("/chat-api/knowledge/articles/:articleId/edit", requireAuth, (req, res) => {
    const articleId = Number(req.params.articleId);
    const article = getArticleById(articleId, req.user);
    if (!article) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    if (!canEditArticle(article, req.user)) {
      return res.status(403).json({ error: "Недостаточно прав для редактирования статьи." });
    }
    return res.json({ article: withArticleDetails(article, req.user) });
  });

  app.post("/chat-api/knowledge/articles", requireAuth, (req, res) => {
    const payload = articlePayloadFromBody(req.body, req.user, null);
    if (!payload.title) {
      return res.status(400).json({ error: "Нужно указать название статьи." });
    }
    const stamp = nowIso();
    const result = db.prepare(`
      INSERT INTO articles(
        section_id,
        author_user_id,
        slug,
        title,
        excerpt,
        cover_image_url,
        type,
        status,
        content_html,
        content_text,
        seo_title,
        seo_description,
        published_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.sectionId,
      req.user.id,
      payload.slug,
      payload.title,
      payload.excerpt,
      payload.coverImageUrl,
      payload.type,
      payload.status,
      payload.contentHtml,
      payload.contentText,
      payload.seoTitle,
      payload.seoDescription,
      payload.publishedAt,
      stamp,
      stamp
    );
    res.status(201).json({ article: withArticleDetails(getArticleById(Number(result.lastInsertRowid), req.user), req.user) });
  });

  app.patch("/chat-api/knowledge/articles/:articleId", requireAuth, (req, res) => {
    const articleId = Number(req.params.articleId);
    const existing = getArticleById(articleId, req.user);
    if (!existing) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    if (!canEditArticle(existing, req.user)) {
      return res.status(403).json({ error: "Недостаточно прав для редактирования статьи." });
    }

    const payload = articlePayloadFromBody(req.body, req.user, existing);
    db.prepare(`
      UPDATE articles
      SET
        section_id = ?,
        slug = ?,
        title = ?,
        excerpt = ?,
        cover_image_url = ?,
        type = ?,
        status = ?,
        content_html = ?,
        content_text = ?,
        seo_title = ?,
        seo_description = ?,
        published_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      payload.sectionId,
      payload.slug,
      payload.title,
      payload.excerpt,
      payload.coverImageUrl,
      payload.type,
      payload.status,
      payload.contentHtml,
      payload.contentText,
      payload.seoTitle,
      payload.seoDescription,
      payload.publishedAt,
      nowIso(),
      articleId
    );
    res.json({ article: withArticleDetails(getArticleById(articleId, req.user), req.user) });
  });

  app.post("/chat-api/knowledge/articles/:articleId/attachments", requireAuth, articleUpload.single("file"), (req, res) => {
    const articleId = Number(req.params.articleId);
    const article = getArticleById(articleId, req.user);
    if (!article) {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(404).json({ error: "Статья не найдена." });
    }
    if (!canEditArticle(article, req.user)) {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(403).json({ error: "Недостаточно прав для загрузки файлов." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Файл обязателен." });
    }

    const fileUrl = `/article-uploads/${path.basename(req.file.path)}`;
    const attachment = db.prepare(`
      INSERT INTO article_attachments(
        article_id,
        uploader_user_id,
        file_name,
        file_url,
        file_kind,
        mime_type,
        file_size,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      articleId,
      req.user.id,
      cleanText(req.file.originalname, 240),
      fileUrl,
      detectFileKind(req.file.mimetype),
      cleanText(req.file.mimetype, 120),
      req.file.size || 0,
      nowIso()
    );
    res.status(201).json({
      attachment: getArticleAttachment(Number(attachment.lastInsertRowid))
    });
  });

  app.post("/chat-api/knowledge/articles/:articleId/reactions", requireAuth, (req, res) => {
    const articleId = Number(req.params.articleId);
    const article = getArticleById(articleId, req.user);
    if (!article || (!article.isPublished && !canViewPrivateArticle(article, req.user))) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    const reaction = normalizeReaction(req.body.reaction);
    if (!reaction) {
      return res.status(400).json({ error: "Недопустимая реакция." });
    }
    toggleArticleReaction(articleId, req.user.id, reaction);
    res.json({ ok: true, reactions: getArticleReactionSummary(articleId, req.user.id) });
  });

  app.post("/chat-api/knowledge/articles/:articleId/comments", requireAuth, (req, res) => {
    const articleId = Number(req.params.articleId);
    const article = getArticleById(articleId, req.user);
    if (!article || (!article.isPublished && !canViewPrivateArticle(article, req.user))) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    const content = cleanText(req.body.content, 4000);
    const parentCommentId = req.body.parentCommentId ? Number(req.body.parentCommentId) : null;
    if (!content) {
      return res.status(400).json({ error: "Комментарий пустой." });
    }
    if (parentCommentId) {
      const parent = db.prepare("SELECT id, article_id AS articleId FROM article_comments WHERE id = ?").get(parentCommentId);
      if (!parent || Number(parent.articleId) !== articleId) {
        return res.status(400).json({ error: "Неверный родительский комментарий." });
      }
    }
    const stamp = nowIso();
    db.prepare(`
      INSERT INTO article_comments(article_id, parent_comment_id, user_id, content, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(articleId, parentCommentId, req.user.id, content, stamp, stamp);
    res.status(201).json({ comments: getArticleComments(articleId, req.user.id) });
  });

  app.patch("/chat-api/knowledge/comments/:commentId", requireAuth, (req, res) => {
    const commentId = Number(req.params.commentId);
    const comment = getComment(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Комментарий не найден." });
    }
    if (!canModerateComment(comment, req.user) && comment.userId !== req.user.id) {
      return res.status(403).json({ error: "Недостаточно прав." });
    }
    const nextContent = cleanText(req.body.content, 4000) || comment.content;
    const nextStatus = canModerateComment(comment, req.user)
      ? normalizeCommentStatus(req.body.status, comment.status)
      : comment.status;
    db.prepare("UPDATE article_comments SET content = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(nextContent, nextStatus, nowIso(), commentId);
    res.json({ comments: getArticleComments(comment.articleId, req.user.id) });
  });

  app.delete("/chat-api/knowledge/comments/:commentId", requireAuth, (req, res) => {
    const commentId = Number(req.params.commentId);
    const comment = getComment(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Комментарий не найден." });
    }
    if (!canModerateComment(comment, req.user) && comment.userId !== req.user.id) {
      return res.status(403).json({ error: "Недостаточно прав." });
    }
    db.prepare("UPDATE article_comments SET status = 'deleted', updated_at = ? WHERE id = ?").run(nowIso(), commentId);
    res.json({ comments: getArticleComments(comment.articleId, req.user.id) });
  });

  app.post("/chat-api/knowledge/comments/:commentId/reactions", requireAuth, (req, res) => {
    const commentId = Number(req.params.commentId);
    const comment = getComment(commentId);
    if (!comment || comment.status === "deleted") {
      return res.status(404).json({ error: "Комментарий не найден." });
    }
    const reaction = normalizeReaction(req.body.reaction);
    if (!reaction) {
      return res.status(400).json({ error: "Недопустимая реакция." });
    }
    toggleCommentReaction(commentId, req.user.id, reaction);
    res.json({ ok: true, reactions: getCommentReactionSummary(commentId, req.user.id) });
  });

  app.get("/chat-api/admin/knowledge/articles", requireAdmin, (_req, res) => {
    res.json({
      articles: listArticles({
        viewer: _req.user,
        includeAllStatuses: true
      }),
      sections: listSectionsTree()
    });
  });

  app.patch("/chat-api/admin/knowledge/articles/:articleId/status", requireAdmin, (req, res) => {
    const articleId = Number(req.params.articleId);
    const article = getArticleById(articleId, req.user);
    if (!article) {
      return res.status(404).json({ error: "Статья не найдена." });
    }
    const nextStatus = normalizeAdminArticleStatus(req.body.status, article.status);
    const publishedAt = nextStatus === "published"
      ? (article.publishedAt || nowIso())
      : (nextStatus === "archived" ? article.publishedAt : null);
    db.prepare("UPDATE articles SET status = ?, published_at = ?, updated_at = ? WHERE id = ?")
      .run(nextStatus, publishedAt, nowIso(), articleId);
    res.json({ article: withArticleDetails(getArticleById(articleId, req.user), req.user) });
  });

  app.get("/chat-api/admin/knowledge/comments", requireAdmin, (req, res) => {
    const articleId = cleanInteger(req.query.articleId, 0);
    if (!articleId) {
      return res.json({ comments: [] });
    }
    res.json({ comments: getArticleComments(articleId, req.user.id, true) });
  });

  app.get("/chat-api/admin/knowledge/sections", requireAdmin, (_req, res) => {
    res.json({ sections: listSectionsTree() });
  });

  app.post("/chat-api/admin/knowledge/sections", requireAdmin, (req, res) => {
    const payload = sectionPayloadFromBody(req.body);
    if (!payload.title) {
      return res.status(400).json({ error: "Нужно указать название раздела." });
    }
    db.prepare(`
      INSERT INTO article_sections(parent_id, slug, title, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.parentId,
      payload.slug,
      payload.title,
      payload.description,
      payload.sortOrder,
      payload.isActive,
      nowIso(),
      nowIso()
    );
    res.status(201).json({ sections: listSectionsTree() });
  });

  app.patch("/chat-api/admin/knowledge/sections/:sectionId", requireAdmin, (req, res) => {
    const sectionId = Number(req.params.sectionId);
    const existing = db.prepare("SELECT * FROM article_sections WHERE id = ?").get(sectionId);
    if (!existing) {
      return res.status(404).json({ error: "Раздел не найден." });
    }
    const payload = sectionPayloadFromBody(req.body, existing);
    db.prepare(`
      UPDATE article_sections
      SET parent_id = ?, slug = ?, title = ?, description = ?, sort_order = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      payload.parentId,
      payload.slug,
      payload.title,
      payload.description,
      payload.sortOrder,
      payload.isActive,
      nowIso(),
      sectionId
    );
    res.json({ sections: listSectionsTree() });
  });

  app.delete("/chat-api/admin/knowledge/sections/:sectionId", requireAdmin, (req, res) => {
    const sectionId = Number(req.params.sectionId);
    const section = db.prepare("SELECT id FROM article_sections WHERE id = ?").get(sectionId);
    if (!section) {
      return res.status(404).json({ error: "Раздел не найден." });
    }
    db.prepare("UPDATE articles SET section_id = NULL WHERE section_id = ?").run(sectionId);
    db.prepare("DELETE FROM article_sections WHERE id = ?").run(sectionId);
    res.json({ sections: listSectionsTree() });
  });

  function seedDefaultSections() {
    const insert = db.prepare(`
      INSERT INTO article_sections(parent_id, slug, title, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);
    const findIdBySlug = db.prepare("SELECT id FROM article_sections WHERE slug = ?");
    for (const section of DEFAULT_SECTIONS.filter((item) => !item.parentSlug)) {
      if (findIdBySlug.get(section.slug)) continue;
      const stamp = nowIso();
      insert.run(null, section.slug, section.title, section.description, section.sortOrder, stamp, stamp);
    }
    for (const section of DEFAULT_SECTIONS.filter((item) => item.parentSlug)) {
      if (findIdBySlug.get(section.slug)) continue;
      const parent = findIdBySlug.get(section.parentSlug);
      const stamp = nowIso();
      insert.run(parent?.id || null, section.slug, section.title, section.description, section.sortOrder, stamp, stamp);
    }
  }

  function ensureDefaultArticles() {
    const existingUser = db.prepare(`
      SELECT id, username, display_name AS displayName
      FROM users
      WHERE lower(username) IN ('wizardjiocb', 'shamanchik008')
      ORDER BY id ASC
      LIMIT 1
    `).get() || db.prepare(`
      SELECT id, username, display_name AS displayName
      FROM users
      ORDER BY id ASC
      LIMIT 1
    `).get();

    if (!existingUser) {
      return;
    }

    const sectionIdBySlug = new Map(
      db.prepare("SELECT id, slug FROM article_sections").all().map((row) => [row.slug, row.id])
    );
    const existsBySlug = db.prepare("SELECT id FROM articles WHERE slug = ?");
    const insert = db.prepare(`
      INSERT INTO articles(
        section_id,
        author_user_id,
        slug,
        title,
        excerpt,
        cover_image_url,
        type,
        status,
        content_html,
        content_text,
        seo_title,
        seo_description,
        published_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const article of DEFAULT_ARTICLES) {
      if (existsBySlug.get(article.slug)) {
        continue;
      }
      const stamp = nowIso();
      insert.run(
        sectionIdBySlug.get(article.sectionSlug) || null,
        existingUser.id,
        article.slug,
        article.title,
        article.excerpt,
        article.coverImageUrl,
        article.type,
        sanitizeArticleHtml(article.contentHtml),
        stripHtml(article.contentHtml),
        article.seoTitle,
        article.seoDescription,
        stamp,
        stamp,
        stamp
      );
    }
  }

  function uniqueArticleSlug(base, articleId = null) {
    const normalized = slugify(base).replace(/^channel-/, "article-") || `article-${crypto.randomUUID().slice(0, 8)}`;
    let slug = normalized;
    let suffix = 1;
    const exists = db.prepare("SELECT id FROM articles WHERE slug = ?");
    while (true) {
      const row = exists.get(slug);
      if (!row || Number(row.id) === Number(articleId)) {
        return slug;
      }
      suffix += 1;
      slug = `${normalized.slice(0, 54)}-${suffix}`;
    }
  }

  function stripHtml(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeArticleHtml(value) {
    let html = String(value || "");
    html = html
      .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\sstyle\s*=\s*(['"]).*?\1/gi, "");
    html = html.replace(/<(?!\/?(p|h2|h3|h4|strong|em|b|i|u|s|blockquote|ul|ol|li|a|code|pre|hr|br|img|figure|figcaption|video|source)\b)[^>]*>/gi, "");
    html = html.replace(/<(a|img|video|source)\b([^>]*)>/gi, (_match, tagName, attrs) => {
      const allowed = [];
      for (const attrMatch of attrs.matchAll(/([a-zA-Z:-]+)\s*=\s*(".*?"|'.*?')/g)) {
        const attrName = attrMatch[1].toLowerCase();
        const attrValue = attrMatch[2];
        if (tagName === "a" && ["href", "target", "rel", "title"].includes(attrName)) {
          allowed.push(`${attrName}=${attrValue}`);
        }
        if (tagName === "img" && ["src", "alt", "title"].includes(attrName)) {
          allowed.push(`${attrName}=${attrValue}`);
        }
        if (tagName === "video" && ["src", "poster", "controls", "preload"].includes(attrName)) {
          allowed.push(`${attrName}=${attrValue}`);
        }
        if (tagName === "source" && ["src", "type"].includes(attrName)) {
          allowed.push(`${attrName}=${attrValue}`);
        }
      }
      if (tagName === "a" && !allowed.some((attr) => attr.startsWith("rel="))) {
        allowed.push(`rel="noopener noreferrer nofollow"`);
      }
      if (tagName === "a" && !allowed.some((attr) => attr.startsWith("target="))) {
        allowed.push(`target="_blank"`);
      }
      if (tagName === "video" && !allowed.some((attr) => attr.startsWith("controls="))) {
        allowed.push(`controls="controls"`);
      }
      return `<${tagName}${allowed.length ? ` ${allowed.join(" ")}` : ""}>`;
    });
    return html.trim();
  }

  function normalizeArticleType(value) {
    const allowed = new Set(["article", "practice", "guide", "knowledge", "blog"]);
    const normalized = cleanText(value, 32).toLowerCase() || "article";
    return allowed.has(normalized) ? normalized : "article";
  }

  function normalizeAuthorStatus(value, currentStatus) {
    const normalized = cleanText(value, 24).toLowerCase();
    if (normalized === "review") return "review";
    if (normalized === "draft") return "draft";
    return currentStatus || "draft";
  }

  function normalizeAdminArticleStatus(value, currentStatus) {
    const normalized = cleanText(value, 24).toLowerCase();
    if (["draft", "review", "published", "archived"].includes(normalized)) {
      return normalized;
    }
    return currentStatus || "draft";
  }

  function normalizeCommentStatus(value, currentStatus) {
    const normalized = cleanText(value, 24).toLowerCase();
    if (["active", "hidden", "deleted"].includes(normalized)) {
      return normalized;
    }
    return currentStatus || "active";
  }

  function sectionPayloadFromBody(body, existing = {}) {
    const title = cleanText(body.title, 120) || existing.title || "";
    const parentId = body.parentId ? Number(body.parentId) : null;
    return {
      parentId: Number.isFinite(parentId) ? parentId : null,
      slug: uniqueSectionSlug(cleanText(body.slug, 120) || title, existing.id),
      title,
      description: cleanText(body.description, 420),
      sortOrder: cleanInteger(body.sortOrder, existing.sort_order || existing.sortOrder || 0),
      isActive: boolFromValue(body.isActive, existing.is_active === 1 || existing.isActive !== false) ? 1 : 0
    };
  }

  function uniqueSectionSlug(base, sectionId = null) {
    const normalized = slugify(base) || `section-${crypto.randomUUID().slice(0, 8)}`;
    let slug = normalized;
    let suffix = 1;
    const exists = db.prepare("SELECT id FROM article_sections WHERE slug = ?");
    while (true) {
      const row = exists.get(slug);
      if (!row || Number(row.id) === Number(sectionId)) {
        return slug;
      }
      suffix += 1;
      slug = `${normalized.slice(0, 54)}-${suffix}`;
    }
  }

  function articlePayloadFromBody(body, actor, existing) {
    const title = cleanText(body.title, 180) || existing?.title || "";
    const safeContent = sanitizeArticleHtml(body.contentHtml ?? body.content_html ?? existing?.contentHtml ?? "");
    const contentText = stripHtml(safeContent).slice(0, 20000);
    const status = actor.isAdmin
      ? normalizeAdminArticleStatus(body.status, existing?.status)
      : normalizeAuthorStatus(body.status, existing?.status);
    const shouldPublish = status === "published" && actor.isAdmin;
    return {
      sectionId: body.sectionId ? Number(body.sectionId) : existing?.sectionId || null,
      slug: uniqueArticleSlug(cleanText(body.slug, 120) || title, existing?.id),
      title,
      excerpt: cleanText(body.excerpt, 420) || contentText.slice(0, 220),
      coverImageUrl: cleanText(body.coverImageUrl ?? body.cover_image_url, 600),
      type: normalizeArticleType(body.type || existing?.type),
      status,
      contentHtml: safeContent,
      contentText,
      seoTitle: cleanText(body.seoTitle, 180) || title,
      seoDescription: cleanText(body.seoDescription, 260) || cleanText(body.excerpt, 260) || contentText.slice(0, 220),
      publishedAt: shouldPublish ? (existing?.publishedAt || nowIso()) : (status === "published" ? nowIso() : null)
    };
  }

  function normalizeSectionRow(row) {
    return {
      id: row.id,
      parentId: row.parent_id ?? row.parentId ?? null,
      slug: row.slug,
      title: row.title,
      description: row.description,
      sortOrder: row.sort_order ?? row.sortOrder ?? 0,
      isActive: Boolean(row.is_active ?? row.isActive),
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    };
  }

  function listSectionsTree() {
    const rows = db.prepare(`
      SELECT *
      FROM article_sections
      ORDER BY sort_order ASC, title COLLATE NOCASE ASC
    `).all().map(normalizeSectionRow);
    const map = new Map(rows.map((section) => [section.id, { ...section, children: [] }]));
    const root = [];
    for (const section of map.values()) {
      if (section.parentId && map.has(section.parentId)) {
        map.get(section.parentId).children.push(section);
      } else {
        root.push(section);
      }
    }
    return root;
  }

  function listArticles({ viewer, sectionSlug = "", q = "", type = "", includeOwnDrafts = false, authorUserId = null, includeAllStatuses = false } = {}) {
    const rows = db.prepare(`
      SELECT
        a.id,
        a.section_id AS sectionId,
        a.author_user_id AS authorUserId,
        a.slug,
        a.title,
        a.excerpt,
        a.cover_image_url AS coverImageUrl,
        a.type,
        a.status,
        a.content_html AS contentHtml,
        a.content_text AS contentText,
        a.seo_title AS seoTitle,
        a.seo_description AS seoDescription,
        a.published_at AS publishedAt,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt,
        s.slug AS sectionSlug,
        s.title AS sectionTitle,
        s.parent_id AS sectionParentId,
        parent.slug AS sectionParentSlug,
        parent.title AS sectionParentTitle,
        u.username,
        u.display_name AS displayName,
        (SELECT COUNT(*) FROM article_views av WHERE av.article_id = a.id) AS viewsCount,
        (SELECT COUNT(*) FROM article_comments ac WHERE ac.article_id = a.id AND ac.status = 'active') AS commentsCount,
        (SELECT COUNT(*) FROM article_reactions ar WHERE ar.article_id = a.id) AS reactionsCount,
        (SELECT COUNT(*) FROM article_attachments aa WHERE aa.article_id = a.id) AS attachmentsCount
      FROM articles a
      LEFT JOIN article_sections s ON s.id = a.section_id
      LEFT JOIN article_sections parent ON parent.id = s.parent_id
      JOIN users u ON u.id = a.author_user_id
      ORDER BY COALESCE(a.published_at, a.updated_at) DESC, a.id DESC
    `).all();

    return rows
      .map((row) => normalizeArticleRow(row, viewer))
      .filter((article) => {
        if (authorUserId && article.authorUserId !== authorUserId) return false;
        if (type && article.type !== normalizeArticleType(type)) return false;
        if (sectionSlug && article.sectionSlug !== sectionSlug && article.sectionParentSlug !== sectionSlug) return false;
        if (q) {
          const haystack = `${article.title} ${article.excerpt} ${article.sectionTitle} ${article.author.displayName}`.toLowerCase();
          if (!haystack.includes(q.toLowerCase())) return false;
        }
        if (includeAllStatuses) return true;
        if (article.isPublished) return true;
        if (includeOwnDrafts && viewer && article.authorUserId === viewer.id) return true;
        if (viewer && viewer.isAdmin) return true;
        return false;
      });
  }

  function normalizeArticleRow(row, viewer) {
    return {
      id: row.id,
      sectionId: row.sectionId,
      authorUserId: row.authorUserId,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      coverImageUrl: row.coverImageUrl,
      type: row.type,
      status: row.status,
      isPublished: row.status === "published",
      contentHtml: row.contentHtml,
      contentText: row.contentText,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sectionSlug: row.sectionSlug || "",
      sectionTitle: row.sectionTitle || "Без раздела",
      sectionParentId: row.sectionParentId || null,
      sectionParentSlug: row.sectionParentSlug || "",
      sectionParentTitle: row.sectionParentTitle || "",
      viewsCount: row.viewsCount || 0,
      commentsCount: row.commentsCount || 0,
      reactionsCount: row.reactionsCount || 0,
      attachmentsCount: row.attachmentsCount || 0,
      author: {
        id: row.authorUserId,
        username: row.username,
        displayName: row.displayName,
        isAdmin: isAdminUser({ username: row.username })
      },
      permissions: {
        canEdit: canEditArticle(row, viewer),
        canPublish: Boolean(viewer?.isAdmin),
        canComment: Boolean(viewer),
        canReact: Boolean(viewer)
      }
    };
  }

  function getArticleById(articleId, viewer) {
    const row = db.prepare(`
      SELECT
        a.id,
        a.section_id AS sectionId,
        a.author_user_id AS authorUserId,
        a.slug,
        a.title,
        a.excerpt,
        a.cover_image_url AS coverImageUrl,
        a.type,
        a.status,
        a.content_html AS contentHtml,
        a.content_text AS contentText,
        a.seo_title AS seoTitle,
        a.seo_description AS seoDescription,
        a.published_at AS publishedAt,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt,
        s.slug AS sectionSlug,
        s.title AS sectionTitle,
        s.parent_id AS sectionParentId,
        parent.slug AS sectionParentSlug,
        parent.title AS sectionParentTitle,
        u.username,
        u.display_name AS displayName,
        (SELECT COUNT(*) FROM article_views av WHERE av.article_id = a.id) AS viewsCount,
        (SELECT COUNT(*) FROM article_comments ac WHERE ac.article_id = a.id AND ac.status = 'active') AS commentsCount,
        (SELECT COUNT(*) FROM article_reactions ar WHERE ar.article_id = a.id) AS reactionsCount,
        (SELECT COUNT(*) FROM article_attachments aa WHERE aa.article_id = a.id) AS attachmentsCount
      FROM articles a
      LEFT JOIN article_sections s ON s.id = a.section_id
      LEFT JOIN article_sections parent ON parent.id = s.parent_id
      JOIN users u ON u.id = a.author_user_id
      WHERE a.id = ?
    `).get(articleId);
    return row ? normalizeArticleRow(row, viewer) : null;
  }

  function getArticleBySlug(slug, viewer) {
    const row = db.prepare(`
      SELECT
        a.id,
        a.section_id AS sectionId,
        a.author_user_id AS authorUserId,
        a.slug,
        a.title,
        a.excerpt,
        a.cover_image_url AS coverImageUrl,
        a.type,
        a.status,
        a.content_html AS contentHtml,
        a.content_text AS contentText,
        a.seo_title AS seoTitle,
        a.seo_description AS seoDescription,
        a.published_at AS publishedAt,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt,
        s.slug AS sectionSlug,
        s.title AS sectionTitle,
        s.parent_id AS sectionParentId,
        parent.slug AS sectionParentSlug,
        parent.title AS sectionParentTitle,
        u.username,
        u.display_name AS displayName,
        (SELECT COUNT(*) FROM article_views av WHERE av.article_id = a.id) AS viewsCount,
        (SELECT COUNT(*) FROM article_comments ac WHERE ac.article_id = a.id AND ac.status = 'active') AS commentsCount,
        (SELECT COUNT(*) FROM article_reactions ar WHERE ar.article_id = a.id) AS reactionsCount,
        (SELECT COUNT(*) FROM article_attachments aa WHERE aa.article_id = a.id) AS attachmentsCount
      FROM articles a
      LEFT JOIN article_sections s ON s.id = a.section_id
      LEFT JOIN article_sections parent ON parent.id = s.parent_id
      JOIN users u ON u.id = a.author_user_id
      WHERE a.slug = ?
    `).get(slug);
    return row ? normalizeArticleRow(row, viewer) : null;
  }

  function withArticleDetails(article, viewer) {
    return {
      ...article,
      attachments: getArticleAttachments(article.id),
      reactions: getArticleReactionSummary(article.id, viewer?.id),
      comments: getArticleComments(article.id, viewer?.id),
      related: listArticles({ viewer }).filter((item) => item.id !== article.id && item.sectionId === article.sectionId).slice(0, 4)
    };
  }

  function getArticleAttachments(articleId) {
    return db.prepare(`
      SELECT
        id,
        file_name AS fileName,
        file_url AS fileUrl,
        file_kind AS fileKind,
        mime_type AS mimeType,
        file_size AS fileSize,
        created_at AS createdAt
      FROM article_attachments
      WHERE article_id = ?
      ORDER BY id ASC
    `).all(articleId);
  }

  function getArticleAttachment(attachmentId) {
    return db.prepare(`
      SELECT
        id,
        article_id AS articleId,
        file_name AS fileName,
        file_url AS fileUrl,
        file_kind AS fileKind,
        mime_type AS mimeType,
        file_size AS fileSize,
        created_at AS createdAt
      FROM article_attachments
      WHERE id = ?
    `).get(attachmentId);
  }

  function countArticleViews(articleId) {
    return db.prepare("SELECT COUNT(*) AS count FROM article_views WHERE article_id = ?").get(articleId).count;
  }

  function registerArticleView(articleId, req, res) {
    const actor = getSession(req);
    const visitorToken = ensureVisitorToken(req, res);
    const stamp = nowIso();
    const viewDate = stamp.slice(0, 10);
    if (actor) {
      db.prepare(`
        INSERT OR IGNORE INTO article_views(article_id, user_id, visitor_token, view_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(articleId, actor.userId, visitorToken, viewDate, stamp);
      return;
    }
    db.prepare(`
      INSERT OR IGNORE INTO article_views(article_id, user_id, visitor_token, view_date, created_at)
      VALUES (?, NULL, ?, ?, ?)
    `).run(articleId, visitorToken, viewDate, stamp);
  }

  function ensureVisitorToken(req, res) {
    const cookies = parseCookies(req.headers.cookie || "");
    if (cookies[VISITOR_COOKIE]) {
      return cookies[VISITOR_COOKIE];
    }
    const token = crypto.randomUUID();
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
    setCookie(res, VISITOR_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    return token;
  }

  function normalizeReaction(value) {
    const reaction = cleanText(value, 32).toLowerCase();
    return CONTENT_REACTIONS.includes(reaction) ? reaction : "";
  }

  function toggleArticleReaction(articleId, userId, reaction) {
    const existing = db.prepare("SELECT id FROM article_reactions WHERE article_id = ? AND user_id = ? AND reaction = ?").get(articleId, userId, reaction);
    if (existing) {
      db.prepare("DELETE FROM article_reactions WHERE id = ?").run(existing.id);
      return;
    }
    db.prepare("INSERT INTO article_reactions(article_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?)")
      .run(articleId, userId, reaction, nowIso());
  }

  function getArticleReactionSummary(articleId, viewerId) {
    const rows = db.prepare(`
      SELECT reaction, user_id AS userId
      FROM article_reactions
      WHERE article_id = ?
      ORDER BY id ASC
    `).all(articleId);
    return summarizeReactions(rows, viewerId);
  }

  function toggleCommentReaction(commentId, userId, reaction) {
    const existing = db.prepare("SELECT id FROM article_comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction = ?").get(commentId, userId, reaction);
    if (existing) {
      db.prepare("DELETE FROM article_comment_reactions WHERE id = ?").run(existing.id);
      return;
    }
    db.prepare("INSERT INTO article_comment_reactions(comment_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?)")
      .run(commentId, userId, reaction, nowIso());
  }

  function getCommentReactionSummary(commentId, viewerId) {
    const rows = db.prepare(`
      SELECT reaction, user_id AS userId
      FROM article_comment_reactions
      WHERE comment_id = ?
      ORDER BY id ASC
    `).all(commentId);
    return summarizeReactions(rows, viewerId);
  }

  function summarizeReactions(rows, viewerId) {
    const bucket = new Map();
    for (const reaction of CONTENT_REACTIONS) {
      bucket.set(reaction, { reaction, count: 0, reacted: false });
    }
    for (const row of rows) {
      if (!bucket.has(row.reaction)) continue;
      const item = bucket.get(row.reaction);
      item.count += 1;
      if (viewerId && Number(row.userId) === Number(viewerId)) {
        item.reacted = true;
      }
    }
    return [...bucket.values()].filter((item) => item.count > 0 || item.reacted);
  }

  function getArticleComments(articleId, viewerId, includeHidden = false) {
    const rows = db.prepare(`
      SELECT
        c.id,
        c.article_id AS articleId,
        c.parent_comment_id AS parentCommentId,
        c.user_id AS userId,
        c.content,
        c.status,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        u.username,
        u.display_name AS displayName
      FROM article_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.article_id = ?
      ORDER BY c.created_at ASC, c.id ASC
    `).all(articleId);

    const prepared = rows
      .filter((comment) => includeHidden || comment.status === "active" || comment.userId === viewerId)
      .map((comment) => ({
        id: comment.id,
        articleId: comment.articleId,
        parentCommentId: comment.parentCommentId,
        userId: comment.userId,
        content: comment.status === "deleted" ? "Комментарий удалён." : comment.content,
        status: comment.status,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          id: comment.userId,
          username: comment.username,
          displayName: comment.displayName
        },
        reactions: getCommentReactionSummary(comment.id, viewerId),
        permissions: {
          canEdit: Number(comment.userId) === Number(viewerId),
          canModerate: Boolean(viewerId && publicUserProfile(viewerId)?.isAdmin)
        },
        replies: []
      }));

    const map = new Map(prepared.map((comment) => [comment.id, comment]));
    const root = [];
    for (const comment of prepared) {
      if (comment.parentCommentId && map.has(comment.parentCommentId)) {
        map.get(comment.parentCommentId).replies.push(comment);
      } else {
        root.push(comment);
      }
    }
    return root;
  }

  function getComment(commentId) {
    return db.prepare(`
      SELECT
        id,
        article_id AS articleId,
        parent_comment_id AS parentCommentId,
        user_id AS userId,
        content,
        status
      FROM article_comments
      WHERE id = ?
    `).get(commentId);
  }

  function detectFileKind(mimeType) {
    const type = String(mimeType || "").toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    return "file";
  }

  function canEditArticle(article, actor) {
    if (!actor) return false;
    if (actor.isAdmin) return true;
    return Number(article.authorUserId) === Number(actor.id || actor.userId);
  }

  function canViewPrivateArticle(article, actor) {
    if (!actor) return false;
    if (actor.isAdmin) return true;
    return Number(article.authorUserId) === Number(actor.id || actor.userId);
  }

  function canModerateComment(comment, actor) {
    return Boolean(actor?.isAdmin);
  }
}

module.exports = {
  registerArticlesModule,
  CONTENT_REACTIONS
};
