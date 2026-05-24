// PKCE S256 verification using Web Crypto (Workers-native — no Node deps).
// RFC 7636: BASE64URL(SHA256(ASCII(verifier))) === challenge

export async function verifyS256(verifier, challenge) {
  if (typeof verifier !== "string" || typeof challenge !== "string") return false;
  if (verifier.length < 43 || verifier.length > 128) return false;
  const bytes = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const computed = base64UrlEncode(new Uint8Array(hash));
  return constantTimeEqual(computed, challenge);
}

function base64UrlEncode(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
