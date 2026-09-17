import { hashSha256 } from '../shared/crypto.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const match = request.headers.get('Cookie')?.match(/(^| )__Host-session=([^;]+)/);
  const sessionId = match ? match[2] : null;

  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (!sessionId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers });

  const sessionIdHash = await hashSha256(sessionId);
  const now = Math.floor(Date.now() / 1000);

  const session = await env.DB.prepare(`SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?`)
    .bind(sessionIdHash, now).first();

  if (!session) return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers });

  return new Response(JSON.stringify({
    email: session.email,
    displayName: session.display_name
  }), { headers });
}