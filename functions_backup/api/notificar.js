// functions/api/notificar.js — HUB.nexus Web Push (VAPID via web-push compatible)
// POST /api/notificar — envia push para um usuário

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: CORS }); }
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

// ── helpers base64url ──────────────────────────────────────────
function b64uEncode(buf) {
  const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64uDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const raw = atob(str);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function vapidPubToJwk(b64uPub) {
  const raw = b64uDecode(b64uPub);
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error('VAPID public key inválida');
  const x = b64uEncode(raw.slice(1, 33));
  const y = b64uEncode(raw.slice(33, 65));
  return { kty: 'EC', crv: 'P-256', x, y, ext: true };
}

function vapidPrivToJwk(b64uPriv, b64uPub) {
  const pubJwk = vapidPubToJwk(b64uPub);
  return { ...pubJwk, d: b64uPriv.trim().replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'), key_ops: ['sign'] };
}

async function buildVapidJwt(endpoint, privB64u, pubB64u, subject) {
  const audience = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const header  = b64uEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64uEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp, sub: subject })));
  const signing = `${header}.${payload}`;

  const key = await crypto.subtle.importKey('jwk', vapidPrivToJwk(privB64u, pubB64u), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signing));
  return `${signing}.${b64uEncode(sigBuf)}`;
}

// ── Criptografia de payload Rigorosa (RFC 8291 / aes128gcm) ─────────────
function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(new Uint8Array(a instanceof ArrayBuffer ? a : a.buffer), off); off += a.byteLength; }
  return out;
}

async function encryptPayload(subscription, payloadStr) {
  const enc = new TextEncoder();
  const content = enc.encode(payloadStr);

  const serverKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw = await crypto.subtle.exportKey('raw', serverKP.publicKey);

  const clientPubRaw = b64uDecode(subscription.keys.p256dh);
  const clientPub = await crypto.subtle.importKey('raw', clientPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const authSecret = b64uDecode(subscription.keys.auth);

  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPub }, serverKP.privateKey, 256);
  const sharedKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveBits']);
  
  // FIX: Info string EXATA exigida pelo WebPush
  const webPushInfo = concat(enc.encode('WebPush: info\0'), clientPubRaw, new Uint8Array(serverPubRaw));

  const ikmRaw = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: webPushInfo },
    sharedKey, 256
  );
  const ikmKey = await crypto.subtle.importKey('raw', ikmRaw, 'HKDF', false, ['deriveBits']);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');

  const cekRaw = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: keyInfo }, ikmKey, 128);
  const nonceRaw = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo }, ikmKey, 96);

  const aesKey = await crypto.subtle.importKey('raw', cekRaw, 'AES-GCM', false, ['encrypt']);
  const paddedPlaintext = concat(content, new Uint8Array([2])); // FIX: padding exato
  const cipherText = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceRaw }, aesKey, paddedPlaintext);

  const rsView = new DataView(new ArrayBuffer(4));
  rsView.setUint32(0, 4096, false);
  const header = concat(
    salt,
    new Uint8Array(rsView.buffer),
    new Uint8Array([serverPubRaw.byteLength]),
    new Uint8Array(serverPubRaw)
  );

  return concat(header, new Uint8Array(cipherText));
}

// ── Handler principal ──────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const { email_responsavel, titulo, mensagem, url } = body;
  if (!email_responsavel) return json({ error: 'email obrigatório' }, 400);

  const usuario = await env.DB.prepare('SELECT push_subscription FROM usuarios WHERE email = ?').bind(email_responsavel.toLowerCase().trim()).first();
  if (!usuario?.push_subscription) return json({ enviado: false, motivo: 'Usuário sem subscription' });

  const VAPID_PUBLIC = 'BFxpBhRC-fG6xF9pmof7ICVDN3Ql4HAk3EitGmYIsRTQgitALc3KLQZsRNsVUQFzLxSpfQvXL3EbPS2H4EFYTNU';
  const VAPID_SUBJECT = 'mailto:admin@hub-nexus.com';
  const VAPID_PRIVATE = env.VAPID_PRIVATE_KEY;

  if (!VAPID_PRIVATE) return json({ error: 'Falta VAPID_PRIVATE_KEY' }, 500);

  try {
    const subscription = JSON.parse(usuario.push_subscription);
    if (!subscription.endpoint) return json({ enviado: false, motivo: 'Subscription invalida' });

    const jwt = await buildVapidJwt(subscription.endpoint, VAPID_PRIVATE, VAPID_PUBLIC, VAPID_SUBJECT);
    const pubStrip = VAPID_PUBLIC.trim().replace(/=/g, '');
    const payload = JSON.stringify({ title: titulo || 'HUB.nexus', body: mensagem || '', data: { url: url || '/' } });
    const encrypted = await encryptPayload(subscription, payload);

    const res = await fetch(subscription.endpoint, {
      method:  'POST',
      headers: {
        'Authorization':     `WebPush ${jwt}`,
        'Crypto-Key':        `p256ecdsa=${pubStrip}`,
        'Content-Type':      'application/octet-stream',
        'Content-Encoding':  'aes128gcm',
        'TTL':               '86400',
        'Content-Length':    String(encrypted.byteLength),
      },
      body: encrypted,
    });

    if (!res.ok) return json({ enviado: false, status: res.status, detail: await res.text() });
    return json({ enviado: true, status: res.status });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
