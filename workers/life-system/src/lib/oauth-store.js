// KV-backed OAuth artifact storage for the MCP authorization server.
// Binding: env.TOKENS (declared in wrangler.toml).
//
// Key shapes:
//   oauth:code:<code>      — single-use authorization code         (TTL  60s)
//   oauth:access:<token>   — bearer access token                   (TTL 180d)
//   oauth:refresh:<token>  — refresh token                         (TTL 365d)

const AUTH_CODE_TTL = 60;
const ACCESS_TOKEN_TTL = 15552000;   // 180 days
const REFRESH_TOKEN_TTL = 31536000;  // 365 days

export const TTL = {
  AUTH_CODE: AUTH_CODE_TTL,
  ACCESS_TOKEN: ACCESS_TOKEN_TTL,
  REFRESH_TOKEN: REFRESH_TOKEN_TTL,
};

export function randomToken(byteLen = 32) {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function putAuthCode(env, code, payload) {
  await env.TOKENS.put(`oauth:code:${code}`, JSON.stringify(payload), {
    expirationTtl: AUTH_CODE_TTL,
  });
}

// Reads and immediately deletes — auth codes are single-use per OAuth 2.1.
export async function consumeAuthCode(env, code) {
  const key = `oauth:code:${code}`;
  const raw = await env.TOKENS.get(key);
  if (!raw) return null;
  await env.TOKENS.delete(key);
  return JSON.parse(raw);
}

export async function putAccessToken(env, token, claims) {
  const record = {
    ...claims,
    issued_at: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL,
  };
  await env.TOKENS.put(`oauth:access:${token}`, JSON.stringify(record), {
    expirationTtl: ACCESS_TOKEN_TTL,
  });
  return record;
}

export async function getAccessToken(env, token) {
  const raw = await env.TOKENS.get(`oauth:access:${token}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function putRefreshToken(env, token, claims) {
  const record = {
    ...claims,
    issued_at: Math.floor(Date.now() / 1000),
  };
  await env.TOKENS.put(`oauth:refresh:${token}`, JSON.stringify(record), {
    expirationTtl: REFRESH_TOKEN_TTL,
  });
}

export async function getRefreshToken(env, token) {
  const raw = await env.TOKENS.get(`oauth:refresh:${token}`);
  if (!raw) return null;
  return JSON.parse(raw);
}
