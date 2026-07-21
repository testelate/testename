-- =====================================================================
-- Escavador de Comentários — migração D1
-- Módulo de unificação/análise de comentários (ExportComments + Apify)
-- =====================================================================

CREATE TABLE IF NOT EXISTS escavador_comentarios (
  id                  TEXT PRIMARY KEY,        -- hash determinístico (ver parser-utils.js)
  cliente_id          TEXT NOT NULL,
  post_id             TEXT NOT NULL,
  post_url            TEXT,
  platform            TEXT NOT NULL,           -- instagram | facebook | tiktok | twitter | youtube
  fonte               TEXT NOT NULL,           -- exportcomments | apify
  author_handle       TEXT,                    -- handle/username como veio na origem
  author_nome         TEXT,                    -- nome de exibição, se houver
  author_normalizado  TEXT NOT NULL,           -- handle normalizado (ver normalizarAutor)
  texto               TEXT NOT NULL,
  timestamp_comentario TEXT,                   -- ISO 8601 quando disponível
  likes                INTEGER DEFAULT 0,
  raw_json            TEXT,                    -- linha original, pra auditoria/debug
  importado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cliente_id, post_id, author_normalizado, texto)
);

CREATE INDEX IF NOT EXISTS idx_escavador_cliente ON escavador_comentarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_escavador_autor ON escavador_comentarios(author_normalizado);
CREATE INDEX IF NOT EXISTS idx_escavador_post ON escavador_comentarios(post_id);

-- Agregado de autores, recalculado a cada ingestão (job batch, não trigger)
CREATE TABLE IF NOT EXISTS escavador_autores (
  author_normalizado   TEXT PRIMARY KEY,
  primeira_aparicao     TEXT,
  ultima_aparicao       TEXT,
  total_comentarios     INTEGER DEFAULT 0,
  clientes_distintos    INTEGER DEFAULT 0,
  posts_distintos       INTEGER DEFAULT 0,
  atualizado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Narrativas/clusters identificados pela IA (Gemini, no padrão do VOX.ia)
CREATE TABLE IF NOT EXISTS escavador_narrativas (
  id                 TEXT PRIMARY KEY,
  cliente_id         TEXT NOT NULL,
  cluster_label      TEXT NOT NULL,
  descricao_ia       TEXT,
  comentarios_count  INTEGER DEFAULT 0,
  autores_distintos  INTEGER DEFAULT 0,
  flag_orquestracao  INTEGER DEFAULT 0,        -- 0/1 — setado pela heurística de similaridade
  criado_em          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escavador_narrativa_comentarios (
  narrativa_id  TEXT NOT NULL,
  comentario_id TEXT NOT NULL,
  similaridade  REAL,                          -- score de pertencimento ao cluster, se aplicável
  PRIMARY KEY (narrativa_id, comentario_id)
);

CREATE INDEX IF NOT EXISTS idx_narrativa_cliente ON escavador_narrativas(cliente_id);

-- =====================================================================
-- Fila de priorização — qual post entre os monitorados merece
-- uma das 5 vagas de extração do ExportComments
-- =====================================================================
CREATE TABLE IF NOT EXISTS escavador_fila_priorizacao (
  id                  TEXT PRIMARY KEY,
  cliente_id          TEXT NOT NULL,
  post_id             TEXT NOT NULL,
  post_url            TEXT NOT NULL,
  platform            TEXT,
  score_final         REAL NOT NULL,
  score_volume        REAL DEFAULT 0,
  score_sentimento    REAL DEFAULT 0,
  score_recencia      REAL DEFAULT 0,
  score_alcance       REAL DEFAULT 0,
  metricas_origem     TEXT,              -- JSON com os dados brutos que geraram o score (auditoria)
  status              TEXT NOT NULL DEFAULT 'pendente',  -- pendente | extraido | descartado
  extraido_em         TEXT,
  criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cliente_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_fila_cliente_status ON escavador_fila_priorizacao(cliente_id, status, score_final DESC);
