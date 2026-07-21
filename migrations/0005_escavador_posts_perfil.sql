-- =====================================================================
-- Escavador de Comentários — migração 0005
-- Cria a tabela escavador_posts_perfil, usada pelo endpoint
-- POST /api/escavador/posts-perfil para gravar o pool de publicações
-- trazidas do Ekklesia (via iframe + postMessage) antes de gerar
-- a fila de priorização.
-- =====================================================================

CREATE TABLE IF NOT EXISTS escavador_posts_perfil (
  id                     TEXT PRIMARY KEY,
  cliente_id             TEXT NOT NULL,
  username               TEXT NOT NULL DEFAULT '',
  platform               TEXT NOT NULL DEFAULT '',
  post_id                TEXT NOT NULL,
  post_url               TEXT,
  legenda                TEXT DEFAULT '',
  curtidas               INTEGER DEFAULT 0,
  comentarios_count      INTEGER DEFAULT 0,
  compartilhamentos      INTEGER DEFAULT 0,
  timestamp_publicacao   TEXT,
  criado_em              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cliente_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_perfil_cliente
  ON escavador_posts_perfil(cliente_id, timestamp_publicacao DESC);
