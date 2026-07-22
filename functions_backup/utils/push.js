// functions/utils/push.js — HUB.nexus
// Envia push diretamente (sem fetch interno)

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
  const paddedPlaintext = concat(content, new Uint8Array([2])); 
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

async function enviarPush(env, email, titulo, mensagem, url) {
  const row = await env.DB.prepare('SELECT push_subscription FROM usuarios WHERE email = ?').bind(email.toLowerCase().trim()).first();
  if (!row?.push_subscription) return;
  
  const subscription = JSON.parse(row.push_subscription);
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return;

  const VAPID_PUBLIC = 'BFxpBhRC-fG6xF9pmof7ICVDN3Ql4HAk3EitGmYIsRTQgitALc3KLQZsRNsVUQFzLxSpfQvXL3EbPS2H4EFYTNU';
  const VAPID_SUBJECT = 'mailto:admin@hub-nexus.com';
  if (!env.VAPID_PRIVATE_KEY) return;

  try {
    const jwt = await buildVapidJwt(endpoint, env.VAPID_PRIVATE_KEY, VAPID_PUBLIC, VAPID_SUBJECT);
    const pubStrip = VAPID_PUBLIC.trim().replace(/=/g, '');
    const payloadStr = JSON.stringify({ title: titulo, body: mensagem, data: { url } });
    const encrypted = await encryptPayload(subscription, payloadStr);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `WebPush ${jwt}`,
        'Crypto-Key': `p256ecdsa=${pubStrip}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Content-Length': String(encrypted.byteLength),
      },
      body: encrypted,
    });

    if (res.status === 410 || res.status === 404) {
      await env.DB.prepare('UPDATE usuarios SET push_subscription = NULL WHERE email = ?').bind(email.toLowerCase().trim()).run();
    }
  } catch (e) {
    // Falha silenciosa
  }
}

export async function notificarResponsavel(env, { responsavel, titulo, mensagem, url = '/' }) {
  if (!responsavel) return;
  try {
    let email = responsavel.trim();
    if (!email.includes('@')) {
      const u = await env.DB.prepare('SELECT email FROM usuarios WHERE email LIKE ? OR nome LIKE ? LIMIT 1')
        .bind(`${email}%`, `%${email}%`).first();
      if (!u?.email) return;
      email = u.email;
    }
    await enviarPush(env, email, titulo, mensagem, url);
  } catch (e) { 
    console.error(e);
  }
}
