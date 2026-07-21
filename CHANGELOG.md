# Fixes SECOM — hiperlinks + prompt da IA

## pages/ekklesia-multi-radar.html
- `linkifyMentions()`: reescrita para normalizar variacoes que a IA gera
  (parenteses duplos `((url))`, colchete dentro de parenteses `([url])`,
  espaco entre `]` e `(`) antes de converter em link. Agora reconhece
  tanto o formato markdown `[@handle](url)` (padrao do SECOM) quanto o
  formato `@handle (url)` (padrao do Embratur), com URL solta como
  fallback final. Resolve os hiperlinks quebrados/exibidos crus no
  relatorio.
- Campos "Em Alta" (Trending Topics) e "Tendencias no Google": agora
  passam por `linkifyMentions()` quando vem da IA (antes iam direto pro
  HTML sem escape nem conversao de link).

## pages/ekklesia-secom.html
- Prompt da IA (`buildPrompt()`):
  - Corrigida contradicao interna: a regra 6 mandava usar "URL pura,
    sem colchetes nem markdown", mas todos os campos pediam o formato
    markdown `[@handle](link)`. Isso confundia o modelo e gerava links
    inconsistentes. Unificado para markdown em todo o prompt.
  - Adicionadas diretrizes de tom e rigor analitico (no espirito do
    prompt do Embratur, adaptado pro contexto de governo): exigencia de
    numeros concretos em vez de superlativos vagos, explicacao do
    mecanismo por tras da viralizacao (nao so descricao), postura
    consultiva com acao especifica, e leitura tecnica/nao-partidaria
    (sem juizo politico-ideologico).
  - Campo "Resumo do dia": limite de palavras subido de 220 para 280 e
    reforcada a exigencia de que cada frase traga informacao nova
    (numero, mecanismo ou implicacao).
  - Campos "Pontos de Atencao" e "Analise por Tema": reforcada a
    exigencia de titulos/acoes especificos em vez de genericos (ex.:
    banido "monitorar" sozinho como acao, banido "reforcar comunicacao"
    sem canal/formato/porta-voz).
