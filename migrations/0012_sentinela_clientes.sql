-- Migração: Criação da tabela sentinela_clientes para armazenar empresas e seus prompts personalizados
CREATE TABLE IF NOT EXISTS sentinela_clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    prompt_single TEXT NOT NULL DEFAULT '',
    prompt_multi TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
