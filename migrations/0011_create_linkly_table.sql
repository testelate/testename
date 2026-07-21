-- Migração: Criação da tabela linkly_urls para o módulo Linkly
CREATE TABLE IF NOT EXISTS linkly_urls (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_linkly_short_code ON linkly_urls(short_code);
