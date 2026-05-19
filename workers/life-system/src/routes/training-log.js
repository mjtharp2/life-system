// HTTP route handlers for /api/training-log/sessions.
// Auth: Bearer token via env.TRAINING_LOG_TOKEN.
// Internal logic lives in src/lib/db.js so MCP tools (Phase 2) can reuse it.

import { checkBearerToken } from "../lib/auth.js";
import { validateSessionPayload, insertTrainingSession, findExistingSession, queryTrainingSessions } from "../lib/db.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
