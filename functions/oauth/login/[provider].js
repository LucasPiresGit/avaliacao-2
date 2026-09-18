import { generateRandomToken, hashSha256, generateCodeChallenge } from '../../shared/crypto.js';

export async function onRequestGet(context) {
  const provider = context.params.provider;
  if (provider !== 'google' && provider !== 'github') {
    return new Response('Not Found', { status: 404 });
  }

  const env = context.env;
  const txId = generateRandomToken();
  const state = generateRandomToken();
  const codeVerifier = generateRandomToken();
  const nonce = provider === 'google' ? generateRandomToken() : null;
  
  const txIdHash = await hashSha256(txId);
  const stateHash = await hashSha256(state);
  const expiresAt = Math.floor(Date.now() / 1000) + 600;


  await env.DB.prepare(
    `INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(txIdHash, provider, stateHash, nonce, codeVerifier, expiresAt).run();

  const redirectUri = `${env.PUBLIC_BASE_URL}/oauth/callback/${provider}`;
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  let authUrl = '';

  if (provider === 'google') {
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256&nonce=${nonce}`;
  } else {
    authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl,
      'Set-Cookie': `__Host-oauth-tx=${txId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}