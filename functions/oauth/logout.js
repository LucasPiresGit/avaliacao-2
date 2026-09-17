import { hashSha256 } from '../shared/crypto.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const origin = request.headers.get('Origin');
  if (origin !== env.PUBLIC_BASE_URL) {
    return new Response('Origem inválida', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const match = request.headers.get('Cookie')?.match(/(^| )__Host-session=([^;]+)/);
  if (match) {
    const sessionIdHash = await hashSha256(match[2]);
    await env.DB.prepare(`DELETE FROM sessions WHERE id_hash = ?`).bind(sessionIdHash).run();
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': env.PUBLIC_BASE_URL,
      'Cache-Control': 'no-store',
      'Set-Cookie': `__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    }
  });
}