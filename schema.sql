-- ══════════════════════════════════════════════════════════════
-- HUB.nexus — Schema D1 (Cloudflare)
-- Execute via: wrangler d1 execute hub-nexus --file=schema.sql
-- ══════════════════════════════════════════════════════════════

-- ── usuarios ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT    DEFAULT (datetime('now')),
  nome       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  cor        TEXT    DEFAULT '#ff6500'
);

CREATE INDEX IF NOT EXISTS usuarios_email_idx ON usuarios (email);

-- ── briefings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS briefings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT    DEFAULT (datetime('now')),
  nome         TEXT    NOT NULL,
  email        TEXT    NOT NULL,
  recomendacao TEXT    DEFAULT '',
  respostas    TEXT    DEFAULT '{}',   -- JSON serializado
  lido         INTEGER DEFAULT 0       -- 0 = false, 1 = true
);

CREATE INDEX IF NOT EXISTS briefings_email_idx      ON briefings (email);
CREATE INDEX IF NOT EXISTS briefings_created_at_idx ON briefings (created_at DESC);

-- ── tasks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    DEFAULT (datetime('now')),
  email       TEXT    DEFAULT '',
  titulo      TEXT    NOT NULL,
  descricao   TEXT    DEFAULT '',
  status      TEXT    DEFAULT 'pendente',
  prio        TEXT    DEFAULT 'media',
  tipo        TEXT    DEFAULT '',
  prof_id     TEXT    DEFAULT '',
  responsavel TEXT    DEFAULT '',
  avatars     TEXT    DEFAULT '[]',    -- JSON serializado
  tags        TEXT    DEFAULT '[]',    -- JSON serializado
  prazo       TEXT    DEFAULT '',
  est         TEXT    DEFAULT 'producao',
  nota        TEXT    DEFAULT '',
  done        INTEGER DEFAULT 0,
  prog        INTEGER DEFAULT 0,
  ordem       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tasks_email_idx      ON tasks (email);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks (created_at DESC);

-- ── kanban ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    DEFAULT (datetime('now')),
  col         TEXT    NOT NULL DEFAULT 'entrada',
  title       TEXT    NOT NULL,
  tipo        TEXT    DEFAULT '',
  prio        TEXT    DEFAULT 'media',
  prof_id     TEXT    DEFAULT '',
  responsavel TEXT    DEFAULT '',
  dias_offset INTEGER DEFAULT 3,
  avatars     TEXT    DEFAULT '[]',    -- JSON serializado
  bar         TEXT    DEFAULT '#ff6500',
  ordem       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS kanban_col_idx        ON kanban (col);
CREATE INDEX IF NOT EXISTS kanban_created_at_idx ON kanban (created_at DESC);

-- ─── Studio: apresentações ───
CREATE TABLE IF NOT EXISTS studio_presentations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Sem nome',
  slides_json TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_studio_updated ON studio_presentations(updated_at DESC);

-- ─── Linkly: encurtador de links ───
CREATE TABLE IF NOT EXISTS linkly_urls (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_linkly_short_code ON linkly_urls(short_code);

