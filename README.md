# Fix — Recorte da Semanal (Embratur)

**Confirmado por Daniel/Brena (WhatsApp, 02/07/2026):** o recorte da aba **Semanal** deve ser por dia de calendário (00h–23h59). Ele estava usando o mesmo `_dataRel` do **Diário**, que tem corte às 6h da manhã — isso deslocava posts de madrugada pro dia seguinte e podia transformar uma semana de 7 dias em 8 "buckets", fazendo o fallback de "últimos 7 dias" descartar o mais antigo silenciosamente.

**Exemplo real (EUA_RP.xlsx, 602 posts):** com `_dataRel` viravam 8 dias distintos e o sistema mostrava 594 menções. Com dia de calendário puro, voltam a ser 7 dias e 602 menções — sem perda.

---

## O que mudou

**Arquivo:** `pages/ekklesia-embratur.html`  
**Função:** `_embSemCalcKPIsSemana` (linha ~1020)  
**Mudança:** 1 linha (`getDia`) — ver `fix-embratur-recorte-semanal.patch`

```diff
-    const getDia = r => r._dataRel || (r.data || '').substring(0, 10);
+    const getDia = r => (r.data || '').substring(0, 10);
```

O Diário continua intacto — usa `_dataRel`/`_embDiaRelatorio()` normalmente, esse comportamento é o correto pra ele e não foi tocado.

---

## Conteúdo deste pacote

```
pages/ekklesia-embratur.html          — arquivo já corrigido, pronto pra substituir
fix-embratur-recorte-semanal.patch    — diff, se preferir aplicar via patch/git apply
README.md                              — este arquivo
```

---

## Deploy

### Opção A — substituir o arquivo direto

```bash
# Copie pages/ekklesia-embratur.html deste pacote pro seu repo local,
# sobrescrevendo o existente

cd /caminho/para/hub.nexus-main
git add pages/ekklesia-embratur.html
git commit -m "fix: recorte da semanal usa dia de calendario (00h-23h59), nao mais o corte 6h do diario"
git push origin main
```

### Opção B — aplicar o patch

```bash
cd /caminho/para/hub.nexus-main
patch -p0 < fix-embratur-recorte-semanal.patch
# ou: git apply fix-embratur-recorte-semanal.patch

git add pages/ekklesia-embratur.html
git commit -m "fix: recorte da semanal usa dia de calendario (00h-23h59), nao mais o corte 6h do diario"
git push origin main
```

Cloudflare Pages faz o deploy automático no push.

---

## Validar depois do deploy

1. Abra `ekklesia-embratur.html` → aba Semanal → EUA
2. Suba de novo o `EUA_RP.xlsx` (ou reabra a base já acumulada)
3. Menções deve mostrar **602**, igual ao total da base acumulada
4. Repita a checagem para os outros países na próxima subida (esp, fra, uk, deu, chn) — a lógica é a mesma pra todos, mas vale conferir
