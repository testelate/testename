-- HUB.nexus - Sentinela: histórico de alertas por cliente
-- Cloudflare D1 / SQLite

CREATE TABLE IF NOT EXISTS alertas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente      TEXT NOT NULL,
  texto_gerado TEXT NOT NULL DEFAULT '',
  fonte        TEXT NOT NULL DEFAULT '',
  modelo       TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_cliente_data
  ON alertas (cliente, created_at DESC);
