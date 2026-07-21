-- HUB.nexus - Modelo padrao de relatorio (duplicavel)
-- Cloudflare D1 / SQLite
-- Modulo isolado: nao referencia tabelas da Embratur nem do Ekklesia multi-cliente.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS relatorio_modelos (
  id           TEXT PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  titulo       TEXT NOT NULL DEFAULT '',
  capa         TEXT NOT NULL DEFAULT '',
  secoes       TEXT NOT NULL DEFAULT '[]',
  is_template  INTEGER NOT NULL DEFAULT 0 CHECK (is_template IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relatorio_modelo_shares (
  token        TEXT PRIMARY KEY,
  relatorio_id TEXT NOT NULL,
  dados        TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_relatorio_modelo_shares_rel
  ON relatorio_modelo_shares (relatorio_id);
