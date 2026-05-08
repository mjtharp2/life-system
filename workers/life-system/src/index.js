// Life System worker — multi-route handler.
// - Root path with ?path&token query: Oura CORS proxy (preserved from original)
// - /health: liveness check
// - /oauth/todoist/callback: Todoist OAuth redirect handler (Phase 1 stub)
// - /oauth/google/callback: Google OAuth redirect handler (Phase 2 stub)
//
// KV binding: env.TOKENS — for OAuth tokens, refresh tokens, user config
// D1 binding: env.DB — for check-ins, scheduling proposals, audit log

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

    // Oura CORS proxy — preserved at root path with ?path&token query.
    // Dashboard depends on this exact URL pattern; do not change.
    if (url.pathname === "/" && url.searchParams.has("path") && url.searchParams.has("token")) {
      return ouraProxy(url);
    }

    // OAuth callbacks — stubs for Phase 1 (Todoist) and Phase 2 (Google).
    // Currently log the callback and return a placeholder. Real token
    // exchange happens when the respective phases ship.
    if (url.pathname === "/oauth/todoist/callback") {
      return oauthCallbackStub("todoist", url);
    }
    if (url.pathname === "/oauth/google/callback") {
      return oauthCallbackStub("google", url);
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
