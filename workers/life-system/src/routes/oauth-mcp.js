// OAuth 2.1 authorization server + protected-resource metadata for the MCP endpoint.
// Pre-shared client credentials (env.MCP_CLIENT_ID / env.MCP_CLIENT_SECRET) — no DCR.
// PKCE S256 required. Resource indicator (RFC 8707) bound to the /mcp canonical URI.

import { verifyS256 } from "../lib/oauth-pkce.js";
import {
  putAuthCode,
  consumeAuthCode,
  putAccessToken,
  putRefreshToken,
  getRefreshToken,
  randomToken,
  TTL,
} from "../lib/oauth-store.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SCOPE = "substrate";

function originFor(request) {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function canonicalResource(request) {
  return `${originFor(request)}/mcp`;
}

function jsonResponse(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extra },
  });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Discovery endpoints (RFC 9728 + RFC 8414) ─────────────────────────────

export function handleProtectedResourceMetadata(request) {
  const origin = originFor(request);
  return jsonResponse({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
  });
}

export function handleAuthorizationServerMetadata(request) {
  const origin = originFor(request);
  return jsonResponse({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/mcp/authorize`,
    token_endpoint: `${origin}/oauth/mcp/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    scopes_supported: [SCOPE],
    authorization_response_iss_parameter_supported: true,
  });
}

// ─── /oauth/mcp/authorize ──────────────────────────────────────────────────
//
// PERMISSIVE FIRST-INSTALL POSTURE for redirect_uri:
//   We accept any https URI whose host is claude.ai or *.claude.ai and log the
//   exact incoming value on every request. This is intentional for first
//   install so we can observe Claude.ai's actual callback path via
//   `wrangler tail` and tighten to an exact-match allowlist in a follow-up
//   commit. Do NOT generalize this to other domains.

function redirectUriAllowed(uri) {
  try {
    const u = new URL(uri);
    if (u.protocol !== "https:") return false;
    return u.hostname === "claude.ai" || u.hostname.endsWith(".claude.ai");
  } catch {
    return false;
  }
}

export async function handleAuthorizeGet(request, env) {
  const url = new URL(request.url);
  const ctx = readAuthorizeParams(url.searchParams);

  console.log("[oauth:mcp:authorize] GET incoming", {
    redirect_uri: ctx.redirect_uri,
    client_id_match: ctx.client_id === env.MCP_CLIENT_ID,
    resource: ctx.resource,
    code_challenge_method: ctx.code_challenge_method,
    scope: ctx.scope,
    has_state: !!ctx.state,
  });

  const err = validateAuthorizeParams(ctx, env, request);
  if (err) return htmlError(err.status, err.message);

  return new Response(renderConsentPage(ctx), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function handleAuthorizePost(request, env) {
  const form = await request.formData();
  const ctx = readAuthorizeParams(form);
  ctx.approve = form.get("approve");

  console.log("[oauth:mcp:authorize] POST submit", {
    redirect_uri: ctx.redirect_uri,
    approve: ctx.approve,
  });

  const err = validateAuthorizeParams(ctx, env, request);
  if (err) return htmlError(err.status, err.message);

  if (ctx.approve !== "1") {
    return redirectWithError(ctx.redirect_uri, ctx.state, "access_denied", "User denied the request");
  }

  const code = randomToken();
  await putAuthCode(env, code, {
    client_id: ctx.client_id,
    code_challenge: ctx.code_challenge,
    redirect_uri: ctx.redirect_uri,
    resource: ctx.resource,
    scope: ctx.scope,
  });

  const issuer = originFor(request);
  const u = new URL(ctx.redirect_uri);
  u.searchParams.set("code", code);
  if (ctx.state) u.searchParams.set("state", ctx.state);
  u.searchParams.set("iss", issuer);
  return Response.redirect(u.toString(), 302);
}

function readAuthorizeParams(src) {
  return {
    response_type: src.get("response_type"),
    client_id: src.get("client_id"),
    redirect_uri: src.get("redirect_uri"),
    code_challenge: src.get("code_challenge"),
    code_challenge_method: src.get("code_challenge_method"),
    resource: src.get("resource"),
    scope: src.get("scope") || SCOPE,
    state: src.get("state") || "",
  };
}

function validateAuthorizeParams(ctx, env, request) {
  if (!env.MCP_CLIENT_ID || !env.MCP_CLIENT_SECRET) {
    return { status: 500, message: "Server misconfigured: MCP_CLIENT_ID / MCP_CLIENT_SECRET not set" };
  }
  if (ctx.response_type !== "code") {
    return { status: 400, message: "response_type must be 'code'" };
  }
  if (ctx.client_id !== env.MCP_CLIENT_ID) {
    return { status: 400, message: "Unknown client_id" };
  }
  if (!ctx.redirect_uri || !redirectUriAllowed(ctx.redirect_uri)) {
    return { status: 400, message: `redirect_uri not allowed: ${ctx.redirect_uri}` };
  }
  if (ctx.code_challenge_method !== "S256") {
    return { status: 400, message: "code_challenge_method must be 'S256' (PKCE required)" };
  }
  if (!ctx.code_challenge || ctx.code_challenge.length < 43) {
    return { status: 400, message: "code_challenge missing or too short" };
  }
  const expectedResource = canonicalResource(request);
  if (ctx.resource !== expectedResource) {
    return { status: 400, message: `resource must equal ${expectedResource} (RFC 8707), got ${ctx.resource}` };
  }
  return null;
}

function htmlError(status, message) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Authorization error</title>
     <div style="font-family:system-ui;max-width:480px;margin:4em auto;padding:1em;">
       <h1 style="font-size:1.4em;">Authorization error</h1>
       <p style="color:#b00;">${escapeHtml(message)}</p>
     </div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function redirectWithError(redirectUri, state, error, description) {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (description) u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  return Response.redirect(u.toString(), 302);
}

function renderConsentPage(ctx) {
  return `<!doctype html>
<meta charset="utf-8">
<title>Authorize life-system MCP</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4em auto; padding: 1em; color: #222; }
  h1 { font-size: 1.4em; margin-bottom: 0.3em; }
  p { line-height: 1.5; }
  .meta { background: #f4f4f4; border-radius: 6px; padding: 1em; font-size: 0.9em; color: #555; margin-top: 1em; }
  .meta div { margin: 0.35em 0; word-break: break-all; }
  form { margin-top: 1.5em; }
  button { font-size: 1em; padding: 0.6em 1.4em; border: 0; border-radius: 6px; background: #1f6feb; color: white; cursor: pointer; }
  button:hover { background: #155ec0; }
</style>
<h1>Authorize life-system MCP</h1>
<p>An OAuth client is requesting access to your life-system substrate (training log read + write).</p>
<div class="meta">
  <div><strong>Client:</strong> ${escapeHtml(ctx.client_id)}</div>
  <div><strong>Redirect:</strong> ${escapeHtml(ctx.redirect_uri)}</div>
  <div><strong>Resource:</strong> ${escapeHtml(ctx.resource)}</div>
  <div><strong>Scope:</strong> ${escapeHtml(ctx.scope)}</div>
</div>
<form method="POST" action="/oauth/mcp/authorize">
  <input type="hidden" name="response_type" value="${escapeHtml(ctx.response_type)}">
  <input type="hidden" name="client_id" value="${escapeHtml(ctx.client_id)}">
  <input type="hidden" name="redirect_uri" value="${escapeHtml(ctx.redirect_uri)}">
  <input type="hidden" name="code_challenge" value="${escapeHtml(ctx.code_challenge)}">
  <input type="hidden" name="code_challenge_method" value="${escapeHtml(ctx.code_challenge_method)}">
  <input type="hidden" name="resource" value="${escapeHtml(ctx.resource)}">
  <input type="hidden" name="scope" value="${escapeHtml(ctx.scope)}">
  <input type="hidden" name="state" value="${escapeHtml(ctx.state)}">
  <input type="hidden" name="approve" value="1">
  <button type="submit">Approve</button>
</form>`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ─── /oauth/mcp/token ──────────────────────────────────────────────────────

export async function handleToken(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "invalid_request", error_description: "POST required" }, 405);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: "invalid_request", error_description: "Body must be application/x-www-form-urlencoded" }, 400);
  }
  const grant = form.get("grant_type");
  if (grant === "authorization_code") return handleAuthorizationCodeGrant(form, env);
  if (grant === "refresh_token") return handleRefreshTokenGrant(form, env);
  return jsonResponse({ error: "unsupported_grant_type" }, 400);
}

async function handleAuthorizationCodeGrant(form, env) {
  const code = form.get("code");
  const verifier = form.get("code_verifier");
  const clientId = form.get("client_id");
  const clientSecret = form.get("client_secret");
  const redirectUri = form.get("redirect_uri");
  const resource = form.get("resource");

  const credErr = checkClientCreds(env, clientId, clientSecret);
  if (credErr) return credErr;

  if (!code) return jsonResponse({ error: "invalid_grant", error_description: "Missing code" }, 400);
  const record = await consumeAuthCode(env, code);
  if (!record) return jsonResponse({ error: "invalid_grant", error_description: "Code not found or expired" }, 400);
  if (record.client_id !== clientId) return jsonResponse({ error: "invalid_grant", error_description: "Code/client mismatch" }, 400);
  if (record.redirect_uri !== redirectUri) return jsonResponse({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  if (record.resource !== resource) return jsonResponse({ error: "invalid_grant", error_description: "resource mismatch" }, 400);
  const pkceOk = await verifyS256(verifier || "", record.code_challenge);
  if (!pkceOk) return jsonResponse({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);

  return issueTokenPair(env, { client_id: clientId, resource: record.resource, scope: record.scope });
}

async function handleRefreshTokenGrant(form, env) {
  const refreshToken = form.get("refresh_token");
  const clientId = form.get("client_id");
  const clientSecret = form.get("client_secret");

  const credErr = checkClientCreds(env, clientId, clientSecret);
  if (credErr) return credErr;

  if (!refreshToken) return jsonResponse({ error: "invalid_grant", error_description: "Missing refresh_token" }, 400);
  const record = await getRefreshToken(env, refreshToken);
  if (!record) return jsonResponse({ error: "invalid_grant", error_description: "Refresh token not found or expired" }, 400);
  if (record.client_id !== clientId) return jsonResponse({ error: "invalid_grant", error_description: "client mismatch" }, 400);

  // Confidential client → no mandatory rotation. Reissue access token, reuse
  // the refresh token. Caller's TTL extends on next /token call if needed.
  return issueTokenPair(env, { client_id: clientId, resource: record.resource, scope: record.scope }, refreshToken);
}

function checkClientCreds(env, clientId, clientSecret) {
  if (!env.MCP_CLIENT_ID || !env.MCP_CLIENT_SECRET) {
    return jsonResponse({ error: "server_error", error_description: "MCP_CLIENT_ID / MCP_CLIENT_SECRET not set" }, 500);
  }
  if (clientId !== env.MCP_CLIENT_ID || !timingSafeEqual(clientSecret || "", env.MCP_CLIENT_SECRET)) {
    return jsonResponse({ error: "invalid_client" }, 401);
  }
  return null;
}

async function issueTokenPair(env, claims, reuseRefreshToken) {
  const accessToken = randomToken();
  await putAccessToken(env, accessToken, claims);
  const refreshToken = reuseRefreshToken || randomToken();
  if (!reuseRefreshToken) {
    await putRefreshToken(env, refreshToken, claims);
  }
  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TTL.ACCESS_TOKEN,
    refresh_token: refreshToken,
    scope: claims.scope,
  });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
