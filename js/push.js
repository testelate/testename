// js/push.js — HUB.nexus Web Push helper (v2 — corrigido)
// Inclua com <script src="/js/push.js"></script> (ou "../js/push.js" nas sub-pastas)

const PUSH_VAPID_PUBLIC = 'BFxpBhRC-fG6xF9pmof7ICVDN3Ql4HAk3EitGmYIsRTQgitALc3KLQZsRNsVUQFzLxSpfQvXL3EbPS2H4EFYTNU';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Retorna: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'
async function getPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return 'unsubscribed';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

// Ativa notificações — registra SW, pede permissão, salva no backend
async function ativarPush(emailUsuario) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Seu navegador não suporta notificações push. Use Chrome ou Edge.');
  }

  // Registrar service worker
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Pedir permissão
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão negada. Clique no cadeado na barra de endereço para habilitar.');

  // Cancelar subscription anterior se existir
  const oldSub = await reg.pushManager.getSubscription();
  if (oldSub) await oldSub.unsubscribe();

  // Criar nova subscription
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC),
  });

  // Salvar no backend
  const res = await fetch('/api/push-subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: emailUsuario, subscription: sub.toJSON() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao salvar subscription no servidor.');
  }

  return sub;
}

// Desativa notificações
async function desativarPush(emailUsuario) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch (e) {
    console.warn('Push unsubscribe error:', e);
  }

  await fetch('/api/push-subscribe', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: emailUsuario }),
  });
}

// Verificar se deve notificar tarefas próximas do prazo (chama do dashboard/tasks)
// avisos: array de { titulo, prazo (HH:MM ou ISO), url }
async function checarNotificacoesProximidade(avisos) {
  if (Notification.permission !== 'granted') return;
  const agora = new Date();

  for (const av of avisos) {
    if (!av.prazo) continue;

    // Suporte a "HH:MM" (hoje) ou ISO completo
    let prazoDate;
    if (/^\d{2}:\d{2}$/.test(av.prazo)) {
      const [h, m] = av.prazo.split(':').map(Number);
      prazoDate = new Date();
      prazoDate.setHours(h, m, 0, 0);
    } else {
      prazoDate = new Date(av.prazo);
    }

    const diff = (prazoDate - agora) / 60000; // minutos

    if (diff > 0 && diff <= 10) {
      dispararNotificacaoLocal(`⏰ Faltam ${Math.ceil(diff)} minutos!`, `${av.titulo} precisa ser entregue em breve.`, av.url);
    } else if (diff > 10 && diff <= 60) {
      dispararNotificacaoLocal(`⏰ Falta 1 hora`, `${av.titulo} vence às ${av.prazo}.`, av.url);
    }
  }
}

// Disparar notificação local (sem push server — apenas se SW estiver ativo)
async function dispararNotificacaoLocal(titulo, body, url) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      await reg.showNotification(titulo, {
        body,
        icon:    '/assets/logo.png',
        badge:   '/assets/logo.png',
        tag:     'hubnexus-local-' + Date.now(),
        data:    { url: url || '/' },
        vibrate: [200, 100, 200],
        actions: [{ action: 'open', title: 'Ver →' }],
      });
    } else if (Notification.permission === 'granted') {
      new Notification(titulo, { body, icon: '/assets/logo.png' });
    }
  } catch (e) {
    console.warn('Notificação local falhou:', e);
  }
}
