-- =====================================================================
-- Escavador de Comentários — migração 0003
-- Suporte ao fluxo "Criação de análise": gera TXT (prompt + base
-- indexada) pra colar numa IA externa, e recebe o JSON de volta,
-- resolvendo os índices pros comentários reais.
-- =====================================================================

CREATE TABLE IF NOT EXISTS escavador_exports_analise (
  id                 TEXT PRIMARY KEY,
  cliente_id         TEXT NOT NULL,
  total_comentarios  INTEGER DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pendente',  -- pendente | processado
  criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
  processado_em      TEXT
);

CREATE INDEX IF NOT EXISTS idx_exports_cliente ON escavador_exports_analise(cliente_id, criado_em DESC);

-- Mapeamento índice numérico (o que a IA externa vê e devolve) -> comentário real
CREATE TABLE IF NOT EXISTS escavador_export_itens (
  export_id     TEXT NOT NULL,
  indice        INTEGER NOT NULL,
  comentario_id TEXT NOT NULL,
  PRIMARY KEY (export_id, indice)
);
