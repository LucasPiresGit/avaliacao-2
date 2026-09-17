import { generateRandomToken, hashSha256 } from '../../shared/crypto.js';

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) { str += '='; }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getCookie(request, name) {
  const match = request.headers.get('Cookie')?.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const provider = params.provider;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const headersNoStore = { 'Cache-Control': 'no-store' };

  if (error || !code || !state) return new Response('Erro na resposta do provedor', { status: 400, headers: headersNoStore });

  const txId = getCookie(request, '__Host-oauth-tx');
  if (!txId) return new Response('Transação ausente', { status: 400, headers: headersNoStore });

  const txIdHash = await hashSha256(txId);
  const tx = await env.DB.prepare(`SELECT * FROM oauth_transactions WHERE id_hash = ? AND expires_at > ?`)
    .bind(txIdHash, Math.floor(Date.now() / 1000)).first();

  if (!tx) return new Response('Transação inválida ou expirada', { status: 400, headers: headersNoStore });
  await env.DB.prepare(`DELETE FROM oauth_transactions WHERE id_hash = ?`).bind(txIdHash).run();

  const stateHash = await hashSha256(state);
  if (tx.state !== stateHash || tx.provider !== provider) return new Response('State inválido', { status: 400, headers: headersNoStore });

  const redirectUri = `${env.PUBLIC_BASE_URL}/oauth/callback/${provider}`;
  let subject, email, displayName, issuer;

  if (provider === 'github') {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        code_verifier: tx.code_verifier
      })
    }).then(res => res.json());

    if (!tokenRes.access_token) return new Response('Falha no token', { status: 400, headers: headersNoStore });

    const user = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${tokenRes.access_token}`, 'User-Agent': 'Cloudflare-Pages', 'X-GitHub-Api-Version': '2022-11-28' }
    }).then(res => res.json());

    const revokeRes = await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/grant`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({ access_token: tokenRes.access_token })
    });

    if (revokeRes.status !== 204) return new Response('Falha ao revogar token', { status: 500, headers: headersNoStore });

    issuer = 'https://github.com';
    subject = String(user.id);
    email = user.email || null;
    displayName = user.name || user.login;
  }

if (provider === 'google') {

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: tx.code_verifier
      })
    }).then(res => res.json());

    if (!tokenRes.id_token) return new Response('Falha ao obter id_token', { status: 400, headers: headersNoStore });

    const parts = tokenRes.id_token.split('.');
    if (parts.length !== 3) return new Response('JWT inválido', { status: 400, headers: headersNoStore });
    const [b64Header, b64Payload, b64Signature] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(b64Header)));
    if (header.alg !== 'RS256') return new Response('Algoritmo não suportado', { status: 400, headers: headersNoStore });
    const jwks = await fetch('https://www.googleapis.com/oauth2/v3/certs').then(res => res.json());


    const jwk = jwks.keys.find(k => k.kid === header.kid);
    if (!jwk) return new Response('Chave pública não encontrada', { status: 400, headers: headersNoStore });

    const key = await crypto.subtle.importKey(
      'jwk', 
      jwk, 
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, 
      false, 
      ['verify']
    );

    const signatureBytes = base64UrlDecode(b64Signature);
    const dataBytes = new TextEncoder().encode(`${b64Header}.${b64Payload}`);
    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      signatureBytes,
      dataBytes
    );

    if (!isValid) return new Response('Assinatura do token inválida', { status: 400, headers: headersNoStore });

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(b64Payload)));
    const nowTimestamp = Math.floor(Date.now() / 1000);

    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      return new Response('Emissor inválido', { status: 400, headers: headersNoStore });
    }
    if (payload.aud !== env.GOOGLE_CLIENT_ID) return new Response('Audiência inválida', { status: 400, headers: headersNoStore });
    if (nowTimestamp > payload.exp) return new Response('Token expirado', { status: 400, headers: headersNoStore });
    if (payload.nonce !== tx.nonce) return new Response('Nonce inválido', { status: 400, headers: headersNoStore });

    issuer = payload.iss;
    subject = payload.sub;
    email = payload.email || null;
    displayName = payload.name || 'Usuário Google';
  }

  const sessionId = generateRandomToken();
  const sessionIdHash = await hashSha256(sessionId);
  const now = Math.floor(Date.now() / 1000);
  const sessionExpiresAt = now + 28800;

  await env.DB.prepare(
    `INSERT INTO sessions (id_hash, issuer, subject, email, display_name, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(sessionIdHash, issuer, subject, email, displayName, now, sessionExpiresAt).run();

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ['Location', env.PUBLIC_BASE_URL],
      ['Set-Cookie', `__Host-session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`],
      ['Set-Cookie', `__Host-oauth-tx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`]
    ])
  });
}