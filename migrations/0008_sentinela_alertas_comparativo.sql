-- HUB.nexus - Sentinela: dados de recorte temporal e volume para comparação entre alertas
-- Cloudflare D1 / SQLite

ALTER TABLE alertas ADD COLUMN periodo TEXT NOT NULL DEFAULT '';
ALTER TABLE alertas ADD COLUMN total_publicacoes INTEGER NOT NULL DEFAULT 0;
