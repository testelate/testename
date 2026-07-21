-- =====================================================================
-- Escavador de Comentários — migração 0004
-- Suporte ao relatório one-page: resumo executivo da IA e campos
-- adicionais por narrativa (tom, confiança da suspeita de orquestração).
-- =====================================================================

ALTER TABLE escavador_exports_analise ADD COLUMN resumo_executivo TEXT DEFAULT '';

ALTER TABLE escavador_narrativas ADD COLUMN tom TEXT DEFAULT '';
ALTER TABLE escavador_narrativas ADD COLUMN confianca_orquestracao TEXT DEFAULT '';
ALTER TABLE escavador_narrativas ADD COLUMN justificativa_orquestracao TEXT DEFAULT '';
ALTER TABLE escavador_narrativas ADD COLUMN export_id TEXT DEFAULT '';
