// api/drive-tutorials.js — HUB.nexus (Cloudflare Pages)
// GET /api/drive-tutorials?folder=FOLDER_ID

const CORS = {
  'Access-Control-Allow-Origin':  'https://hub-nexus.pages.dev',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const TIPOS = {
  'video/mp4': { tipo: 'video', icone: '🎬' },
  'video/webm': { tipo: 'video', icone: '🎬' },
  'video/quicktime': { tipo: 'video', icone: '🎬' },
  'application/pdf': { tipo: 'pdf', icone: '📄' },
  'application/vnd.google-apps.video': { tipo: 'video', icone: '🎬' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { tipo: 'pptx', icone: '📊' },
  'application/vnd.google-apps.presentation': { tipo: 'slides', icone: '📊' },
};

function limparNome(n) {
  return n.replace(/\.(mp4|webm|pdf|pptx|docx|mov|avi)$/i,'').replace(/^Tutorial\s*[-–—]\s*/i,'').trim();
}

function categoria(n) {
  const l = n.toLowerCase();
  if (l.includes('ekklesia')||l.includes('brandwatch')||l.includes('stilingue')||l.includes('supermetrics')||l.includes('apify')||l.includes('ir²')||l.includes('ir2')) return 'Ekklesia';
  if (l.includes('briefing')||l.includes('diagnóstico')||l.includes('diagnostico')) return 'Briefing';
  if (l.includes('kanban')||l.includes('tarefa')||l.includes('demanda')) return 'Kanban';
  if (l.includes('ia')||l.includes('claude')||l.includes('whisper')||l.includes('iramuteq')||l.includes('notebooklm')) return 'IA';
  if (l.includes('instagram')||l.includes('facebook')||l.includes('tiktok')||l.includes('linkedin')||l.includes('youtube')||l.includes('redes')||l.includes('social')) return 'Redes Sociais';
  if (l.includes('imprensa')||l.includes('mídia')||l.includes('midia')||l.includes('clipping')) return 'Imprensa';
  if (l.includes('excel')||l.includes('planilha')||l.includes('power bi')||l.includes('grafo')) return 'Dados';
  if (l.includes('script')||l.includes('python')||l.includes('api')||l.includes('código')||l.includes('codigo')) return 'Scripts';
  return 'Geral';
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url      = new URL(request.url);
  const folderId = url.searchParams.get('folder') || env.DRIVE_FOLDER_ID || '1nZDP2BPtEfPl18FdcFWoRLSCcoHQxT7H';
  const apiKey   = env.GOOGLE_API_KEY || '';

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink)',
    pageSize: '100',
    orderBy: 'name',
  });
  if (apiKey) params.set('key', apiKey);

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, msg: 'Configure GOOGLE_API_KEY nas variáveis de ambiente.', tutoriais: [], categorias: [] }), { status: 200, headers: CORS });
    }

    const data    = await res.json();
    const tutoriais = (data.files || [])
      .filter(f => TIPOS[f.mimeType])
      .map(f => ({
        id: f.id,
        titulo: limparNome(f.name),
        nomeOriginal: f.name,
        tipo: TIPOS[f.mimeType].tipo,
        icone: TIPOS[f.mimeType].icone,
        categoria: categoria(f.name),
        viewUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        embedUrl: `https://drive.google.com/file/d/${f.id}/preview`,
        thumb: f.thumbnailLink || null,
        tamanho: f.size ? Math.round(f.size/1024/1024) + ' MB' : null,
        modificado: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('pt-BR') : null,
      }));

    const categorias = [...new Set(tutoriais.map(t => t.categoria))].sort();
    return new Response(JSON.stringify({ ok: true, total: tutoriais.length, categorias, tutoriais }), { status: 200, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, tutoriais: [] }), { status: 500, headers: CORS });
  }
}
