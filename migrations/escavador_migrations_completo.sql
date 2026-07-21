-- =====================================================================
-- Escavador de Comentários — MIGRATIONS CONSOLIDADAS
-- Rode este SQL inteiro no D1 Console do Cloudflare (hub-nexus).
-- Todos os comandos usam IF NOT EXISTS / OR IGNORE — seguro rodar
-- mesmo que algumas tabelas já existam.
-- =====================================================================

-- ── 0001: tabelas base ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escavador_comentarios (
  id                   TEXT PRIMARY KEY,
  cliente_id           TEXT NOT NULL,
  post_id              TEXT NOT NULL,
  post_url             TEXT,
  platform             TEXT NOT NULL,
  fonte                TEXT NOT NULL,
  author_handle        TEXT,
  author_nome          TEXT,
  author_normalizado   TEXT NOT NULL,
  texto                TEXT NOT NULL,
  timestamp_comentario TEXT,
  likes                INTEGER DEFAULT 0,
  raw_json             TEXT,
  importado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cliente_id, post_id, author_normalizado, texto)
);

CREATE INDEX IF NOT EXISTS idx_escavador_cliente ON escavador_comentarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_escavador_autor   ON escavador_comentarios(author_normalizado);
CREATE INDEX IF NOT EXISTS idx_escavador_post    ON escavador_comentarios(post_id);

CREATE TABLE IF NOT EXISTS escavador_autores (
  author_normalizado  TEXT PRIMARY KEY,
  primeira_aparicao   TEXT,
  ultima_aparicao     TEXT,
  total_comentarios   INTEGER DEFAULT 0,
  clientes_distintos  INTEGER DEFAULT 0,
  posts_distintos     INTEGER DEFAULT 0,
  atualizado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escavador_narrativas (
  id                 TEXT PRIMARY KEY,
  cliente_id         TEXT NOT NULL,
  cluster_label      TEXT NOT NULL,
  descricao_ia       TEXT,
  comentarios_count  INTEGER DEFAULT 0,
  autores_distintos  INTEGER DEFAULT 0,
  flag_orquestracao  INTEGER DEFAULT 0,
  criado_em          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escavador_narrativa_comentarios (
  narrativa_id  TEXT NOT NULL,
  comentario_id TEXT NOT NULL,
  similaridade  REAL,
  PRIMARY KEY (narrativa_id, comentario_id)
);

CREATE INDEX IF NOT EXISTS idx_narrativa_cliente ON escavador_narrativas(cliente_id);

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
  metricas_origem     TEXT,
  status              TEXT NOT NULL DEFAULT 'pendente',
  extraido_em         TEXT,
  criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cliente_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_fila_cliente_status
  ON escavador_fila_priorizacao(cliente_id, status, score_final DESC);

-- ── 0003: exports de análise ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escavador_exports_analise (
  id                 TEXT PRIMARY KEY,
  cliente_id         TEXT NOT NULL,
  total_comentarios  INTEGER DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pendente',
  criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
  processado_em      TEXT,
  resumo_executivo   TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_exports_cliente
  ON escavador_exports_analise(cliente_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS escavador_export_itens (
  export_id     TEXT NOT NULL,
  indice        INTEGER NOT NULL,
  comentario_id TEXT NOT NULL,
  PRIMARY KEY (export_id, indice)
);

-- ── 0004: colunas adicionais de narrativa ────────────────────────────
-- ALTER TABLE ignora silenciosamente se a coluna já existir no SQLite

ALTER TABLE escavador_narrativas ADD COLUMN tom                      TEXT DEFAULT '';
ALTER TABLE escavador_narrativas ADD COLUMN confianca_orquestracao   TEXT DEFAULT '';
ALTER TABLE escavador_narrativas ADD COLUMN justificativa_orquestracao TEXT DEFAULT '';
ALTER TABLE escavador_narrativas ADD COLUMN export_id                TEXT DEFAULT '';

-- ── 0005: pool de posts do perfil (Ekklesia → Escavador) ─────────────

CREATE TABLE IF NOT EXISTS escavador_posts_perfil (
  id                   TEXT PRIMARY KEY,
  cliente_id           TEXT NOT NULL,
  username             TEXT NOT NULL DEFAULT '',
  platform             TEXT NOT NULL DEFAULT '',
  post_id              TEXT NOT NULL,
  post_url             TEXT,
  legenda              TEXT DEFAULT '',
  curtidas             INTEGER DEFAULT 0,
  comentarios_count    INTEGER DEFAULT 0,
  compartilhamentos    INTEGER DEFAULT 0,
  timestamp_publicacao TEXT,
  criado_em            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cliente_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_perfil_cliente
  ON escavador_posts_perfil(cliente_id, timestamp_publicacao DESC);


-- ── LIMPEZA: remove comentários com plataforma "desconhecido" ────────
-- Execute APÓS as migrations acima.
-- Remove entradas gravadas antes do fix do parser (sem plataforma detectada)
-- que já foram reimportadas corretamente como "instagram".
-- Só remove "desconhecido" quando o mesmo comentário (mesmo texto + mesmo
-- autor sem prefixo "ig:") já existe com plataforma correta.

DELETE FROM escavador_comentarios
WHERE platform = 'desconhecido'
  AND cliente_id = 'cliente-demo'
  AND EXISTS (
    SELECT 1 FROM escavador_comentarios c2
    WHERE c2.cliente_id = escavador_comentarios.cliente_id
      AND c2.post_id    = escavador_comentarios.post_id
      AND c2.texto      = escavador_comentarios.texto
      AND c2.platform  != 'desconhecido'
  );
