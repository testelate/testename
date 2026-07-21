-- HUB.nexus - Sentinela: alerta padrão por cliente
-- Cloudflare D1 / SQLite

ALTER TABLE alertas ADD COLUMN padrao INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_alertas_cliente_padrao
  ON alertas (cliente, padrao);
