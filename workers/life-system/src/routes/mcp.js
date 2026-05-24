// MCP streamable HTTP endpoint — POST /mcp.
//
// Stateless JSON mode (no SSE, no session IDs) per MCP protocol 2025-06-18.
// Hand-rolled JSON-RPC dispatch — the official TS SDK assumes Node's
// req/res streams and doesn't drop cleanly into the Workers runtime.
//
// Auth: Bearer access token from KV, with audience binding to /mcp (RFC 8707).
// On unauthenticated requests we emit RFC 9728 WWW-Authenticate so MCP clients
// can discover the protected-resource metadata.

import { getAccessToken } from "../lib/oauth-store.js";
import {
  rpcResult,
  rpcError,
  RPC_PARSE_ERROR,
  RPC_INVALID_REQUEST,
  RPC_METHOD_NOT_FOUND,
  RPC_INVALID_PARAMS,
  RPC_INTERNAL_ERROR,
  RPC_HEADER_MISMATCH,
} from "../lib/jsonrpc.js";
import { listToolsForClient, callTool } from "../lib/mcp-tools.js";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "life-system-substrate-mcp", version: "1.0.0" };
const SCOPE = "substrate";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
};

export function handleMcpOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function handleMcp(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // 1. Authenticate via bearer token from KV
  const authResult = await authenticate(request, env);
  if (authResult.error) return authResult.error;
  const claims = authResult.claims;

  // 2. Parse JSON-RPC body
  let body;
  try {
    body = await request.json();
  } catch {
    return rpcHttpResponse(rpcError(null, RPC_PARSE_ERROR, "Invalid JSON body"), 400);
  }
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcHttpResponse(
      rpcError(body?.id ?? null, RPC_INVALID_REQUEST, "Malformed JSON-RPC request"),
      400
    );
  }

  // 3. Validate optional MCP transport headers (DRAFT-2026 spec; clients on
  //    2025-06-18 won't send them). When present, they MUST match the body.
  const headerMethod = request.headers.get("Mcp-Method");
  if (headerMethod !== null && headerMethod !== body.method) {
    return rpcHttpResponse(
      rpcError(body.id ?? null, RPC_HEADER_MISMATCH,
        `Mcp-Method header '${headerMethod}' does not match body method '${body.method}'`),
      400
    );
  }
  if (body.method === "tools/call") {
    const headerName = request.headers.get("Mcp-Name");
    const bodyName = body.params?.name;
    if (headerName !== null && headerName !== bodyName) {
      return rpcHttpResponse(
        rpcError(body.id ?? null, RPC_HEADER_MISMATCH,
          `Mcp-Name header '${headerName}' does not match params.name '${bodyName}'`),
        400
      );
    }
  }

  // 4. Dispatch
  try {
    const response = await dispatch(body, env, claims);
    if (response === null) {
      // Notification — 202 Accepted, no body.
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }
    return rpcHttpResponse(response, 200);
  } catch (e) {
    return rpcHttpResponse(
      rpcError(body.id ?? null, RPC_INTERNAL_ERROR, e.message || "Internal error"),
      200
    );
  }
}

async function dispatch(body, env, _claims) {
  const { id, method, params } = body;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
      return null; // notification — caller returns 202

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: listToolsForClient() });

    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (!name || typeof name !== "string") {
        return rpcError(id, RPC_INVALID_PARAMS, "tools/call requires params.name (string)");
      }
      const result = await callTool(name, args, env);
      if (result?.notFound) {
        return rpcError(id, RPC_METHOD_NOT_FOUND, `Tool not found: ${name}`);
      }
      return rpcResult(id, result);
    }

    default:
      return rpcError(id, RPC_METHOD_NOT_FOUND, `Method not implemented: ${method}`);
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────

async function authenticate(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: unauthorized(request, "Missing or malformed Bearer token") };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const record = await getAccessToken(env, token);
  if (!record) {
    return { error: unauthorized(request, "Invalid or expired access token") };
  }
  const expectedResource = canonicalResource(request);
  if (record.resource !== expectedResource) {
    return { error: unauthorized(request, "Token audience mismatch") };
  }
  return { claims: record };
}

function unauthorized(request, description) {
  const origin = originFor(request);
  return new Response(
    JSON.stringify({ error: "unauthorized", error_description: description }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="${SCOPE}"`,
        ...CORS_HEADERS,
      },
    }
  );
}

function originFor(request) {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function canonicalResource(request) {
  return `${originFor(request)}/mcp`;
}

function rpcHttpResponse(rpc, status) {
  return new Response(JSON.stringify(rpc), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
