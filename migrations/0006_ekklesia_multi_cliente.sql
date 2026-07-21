-- HUB.nexus - Ekklesia multi-cliente
-- Cloudflare D1 / SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ekklesia_clientes (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  favorito   INTEGER NOT NULL DEFAULT 0 CHECK (favorito IN (0, 1)),
  possui_cena INTEGER NOT NULL DEFAULT 0 CHECK (possui_cena IN (0, 1)),
  workflow_status TEXT NOT NULL DEFAULT 'producao' CHECK (workflow_status IN ('producao', 'revisao', 'finalizado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ekklesia_prompts_config (
  id              TEXT PRIMARY KEY,
  cliente_id      TEXT NOT NULL,
  tipo_relatorio  TEXT NOT NULL CHECK (tipo_relatorio IN ('diario', 'semanal', 'mensal')),
  prompt_contexto TEXT NOT NULL DEFAULT '',
  prompt_regras   TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES ekklesia_clientes(id) ON DELETE CASCADE,
  UNIQUE (cliente_id, tipo_relatorio)
);

CREATE TABLE IF NOT EXISTS ekklesia_multi_base (
  id         TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  tipo_relatorio TEXT NOT NULL DEFAULT 'diario' CHECK (tipo_relatorio IN ('diario', 'semanal', 'mensal')),
  data_rel   TEXT NOT NULL,
  dados      TEXT NOT NULL DEFAULT '{}',
  manual     INTEGER NOT NULL DEFAULT 0 CHECK (manual IN (0, 1)),
  criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (cliente_id, id),
  FOREIGN KEY (cliente_id) REFERENCES ekklesia_clientes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ekklesia_clientes_ativo
  ON ekklesia_clientes (ativo, favorito, nome);

CREATE INDEX IF NOT EXISTS idx_ekklesia_prompts_cliente_tipo
  ON ekklesia_prompts_config (cliente_id, tipo_relatorio);

CREATE INDEX IF NOT EXISTS idx_ekklesia_multi_base_cliente_data
  ON ekklesia_multi_base (cliente_id, tipo_relatorio, data_rel);
