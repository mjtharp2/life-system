// Life System worker — multi-route handler.
// - Root path with ?path&token query: Oura CORS proxy (preserved from original)
// - /health: liveness check
// - /api/training-log/sessions: training log read/write (bearer-token auth)
// - /oauth/todoist/callback: Todoist OAuth redirect handler (Phase 1 stub)
// - /oauth/google/callback: Google OAuth redirect handler (Phase 2 stub)
// - /mcp: MCP streamable HTTP endpoint (OAuth 2.1 bearer auth)
// - /.well-known/oauth-protected-resource, /.well-known/oauth-authorization-server
// - /oauth/mcp/authorize, /oauth/mcp/token: OAuth 2.1 endpoints for the MCP server
//
// KV binding: env.TOKENS — for OAuth tokens, refresh tokens, user config
// D1 binding: env.DB — for check-ins, scheduling proposals, training log
// Secrets:
//   env.TRAINING_LOG_TOKEN — bearer token for /api/training-log/* routes
//   env.MCP_CLIENT_ID, env.MCP_CLIENT_SECRET — pre-shared OAuth client creds for MCP

import { handleTrainingLog } from "./routes/training-log.js";
import { handleMcp, handleMcpOptions } from "./routes/mcp.js";
import {
  handleProtectedResourceMetadata,
  handleAuthorizationServerMetadata,
  handleAuthorizeGet,
  handleAuthorizePost,
  handleToken,
  handleOptions as handleOauthOptions,
} from "./routes/oauth-mcp.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check — useful for end-to-end verification.
    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        worker: "plain-hill-28ab",
        bindings: {
          kv: typeof env.TOKENS !== "undefined",
          d1: typeof env.DB !== "undefined",
        },
      });
    }

    // Training log API routes (auth gated inside the handler).
    // Matches /api/training-log/sessions (collection: POST, GET) and
    // /api/training-log/sessions/:id (collection-item: PUT).
    if (
      url.pathname === "/api/training-log/sessions" ||
      url.pathname.startsWith("/api/training-log/sessions/")
    ) {
      return handleTrainingLog(request, env);
    }

    // Oura CORS proxy — preserved at root path with ?path&token query.
    // Dashboard depends on this exact URL pattern; do not change.
    if (url.pathname === "/" && url.searchParams.has("path") && url.searchParams.has("token")) {
      return ouraProxy(url);
    }

    // OAuth callbacks — stubs for Phase 1 (Todoist) and Phase 2 (Google).
    if (url.pathname === "/oauth/todoist/callback") {
      return oauthCallbackStub("todoist", url);
    }
    if (url.pathname === "/oauth/google/callback") {
      return oauthCallbackStub("google", url);
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      if (request.method === "OPTIONS") return handleMcpOptions();
      return handleMcp(request, env);
    }

    // OAuth 2.1 discovery for the MCP server (RFC 9728 + RFC 8414)
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      return handleProtectedResourceMetadata(request);
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return handleAuthorizationServerMetadata(request);
    }

    // OAuth 2.1 endpoints for the MCP server (pre-shared client creds, PKCE)
    if (url.pathname === "/oauth/mcp/authorize") {
      if (request.method === "OPTIONS") return handleOauthOptions();
      if (request.method === "POST") return handleAuthorizePost(request, env);
      return handleAuthorizeGet(request, env);
    }
    if (url.pathname === "/oauth/mcp/token") {
      if (request.method === "OPTIONS") return handleOauthOptions();
      return handleToken(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function ouraProxy(url) {
  const path = url.searchParams.get("path");
  const token = url.searchParams.get("token");
  const ouraUrl = "https://api.ouraring.com/v2/usercollection/" + decodeURIComponent(path);
  const ouraRes = await fetch(ouraUrl, { headers: { Authorization: "Bearer " + token } });
  const data = await ouraRes.text();
  return new Response(data, {
    status: ouraRes.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function oauthCallbackStub(provider, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  console.log(`[oauth:${provider}] callback received`, {
    hasCode: !!code,
    hasState: !!state,
    error,
  });
  return new Response(
    `OAuth callback received for ${provider}. Phase ${provider === "todoist" ? "1" : "2"} will handle the token exchange. You can close this window.`,
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
}
