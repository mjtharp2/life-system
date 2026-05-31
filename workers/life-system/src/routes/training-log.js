// HTTP route handlers for /api/training-log/sessions.
// Auth: Bearer token via env.TRAINING_LOG_TOKEN.
// Internal logic lives in src/lib/db.js so MCP tools (Phase 2) can reuse it.

import { checkBearerToken } from "../lib/auth.js";
import { validateSessionPayload, insertTrainingSession, replaceTrainingSession, findExistingSession, queryTrainingSessions } from "../lib/db.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function handleTrainingLog(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const authError = checkBearerToken(request, env, "TRAINING_LOG_TOKEN");
  if (authError) {
    // Re-emit with CORS so browser callers see the error
    return new Response(authError.body, {
      status: authError.status,
      headers: { ...Object.fromEntries(authError.headers), ...CORS_HEADERS },
    });
  }

  // /api/training-log/sessions/:id — collection-item routes
  const url = new URL(request.url);
  const itemMatch = url.pathname.match(/^\/api\/training-log\/sessions\/([^/]+)$/);
  if (itemMatch) {
    const sessionId = itemMatch[1];
    if (request.method === "PUT") return handlePut(request, env, sessionId);
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  // /api/training-log/sessions — collection routes
  if (request.method === "POST") return handlePost(request, env);
  if (request.method === "GET") return handleGet(request, env);
  return jsonResponse({ success: false, error: "Method not allowed" }, 405);
}

async function handlePost(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ success: false, error: "Invalid JSON in request body" }, 400);
  }

  const validation = validateSessionPayload(payload);
  if (!validation.valid) {
    return jsonResponse({ success: false, error: validation.error }, 400);
  }

  // Idempotency check: if (date, type) already exists, return 409 with existing session_id
  const existingId = await findExistingSession(env, payload.session.date, payload.session.type);
  if (existingId) {
    return jsonResponse(
      { success: false, error: "Session already exists for this (date, type)", session_id: existingId },
      409
    );
  }

  try {
    const result = await insertTrainingSession(env, payload);
    return jsonResponse({ success: true, session_id: result.session_id }, 201);
  } catch (e) {
    return jsonResponse({ success: false, error: `Database error: ${e.message}` }, 500);
  }
}

async function handlePut(request, env, sessionId) {
  // Defense-in-depth UUID shape check; db.js handles existence.
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(sessionId)) {
    return jsonResponse({ success: false, error: "Invalid session_id (must be a UUID)" }, 400);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ success: false, error: "Invalid JSON in request body" }, 400);
  }

  const validation = validateSessionPayload(payload);
  if (!validation.valid) {
    return jsonResponse({ success: false, error: validation.error }, 400);
  }

  try {
    const result = await replaceTrainingSession(env, sessionId, payload);
    if (result.error === "not_found") {
      return jsonResponse({ success: false, error: "Session not found", session_id: sessionId }, 404);
    }
    if (result.error === "collision") {
      return jsonResponse(
        {
          success: false,
          error: `Would collide with existing session ${result.collidingId} at (${payload.session.date}, ${payload.session.type})`,
          colliding_session_id: result.collidingId,
        },
        409
      );
    }
    return jsonResponse({ success: true, session_id: result.session_id, updated: true }, 200);
  } catch (e) {
    return jsonResponse({ success: false, error: `Database error: ${e.message}` }, 500);
  }
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const filters = {
    start_date: url.searchParams.get("start_date") || undefined,
    end_date: url.searchParams.get("end_date") || undefined,
    session_tag: url.searchParams.get("session_tag") || undefined,
    lift_name: url.searchParams.get("lift_name") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  };

  try {
    const sessions = await queryTrainingSessions(env, filters);
    return jsonResponse({ success: true, sessions }, 200);
  } catch (e) {
    return jsonResponse({ success: false, error: `Database error: ${e.message}` }, 500);
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
