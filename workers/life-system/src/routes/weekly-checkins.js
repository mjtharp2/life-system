// HTTP route handlers for /api/weekly-checkins.
// Auth: Bearer token via env.TRAINING_LOG_TOKEN (shared substrate token —
// the same secret guards the /api/training-log/* routes).
// Internal logic lives in src/lib/db.js so MCP tools reuse it.

import { checkBearerToken } from "../lib/auth.js";
import {
  validateCheckinPayload,
  insertWeeklyCheckin,
  replaceWeeklyCheckin,
  findExistingCheckin,
  queryWeeklyCheckins,
} from "../lib/db.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function handleWeeklyCheckins(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const authError = checkBearerToken(request, env, "TRAINING_LOG_TOKEN");
  if (authError) {
    return new Response(authError.body, {
      status: authError.status,
      headers: { ...Object.fromEntries(authError.headers), ...CORS_HEADERS },
    });
  }

  // /api/weekly-checkins/:id — collection-item routes
  const url = new URL(request.url);
  const itemMatch = url.pathname.match(/^\/api\/weekly-checkins\/([^/]+)$/);
  if (itemMatch) {
    const checkinId = itemMatch[1];
    if (request.method === "PUT") return handlePut(request, env, checkinId);
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  // /api/weekly-checkins — collection routes
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

  const validation = validateCheckinPayload(payload);
  if (!validation.valid) {
    return jsonResponse({ success: false, error: validation.error }, 400);
  }

  const existingId = await findExistingCheckin(env, payload.week_start);
  if (existingId) {
    return jsonResponse(
      { success: false, error: "Check-in already exists for this week_start", checkin_id: existingId },
      409
    );
  }

  try {
    const result = await insertWeeklyCheckin(env, payload);
    return jsonResponse(
      { success: true, checkin_id: result.checkin_id, week_start: payload.week_start },
      201
    );
  } catch (e) {
    return jsonResponse({ success: false, error: `Database error: ${e.message}` }, 500);
  }
}

async function handlePut(request, env, checkinId) {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(checkinId)) {
    return jsonResponse({ success: false, error: "Invalid checkin_id (must be a UUID)" }, 400);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ success: false, error: "Invalid JSON in request body" }, 400);
  }

  const validation = validateCheckinPayload(payload);
  if (!validation.valid) {
    return jsonResponse({ success: false, error: validation.error }, 400);
  }

  try {
    const result = await replaceWeeklyCheckin(env, checkinId, payload);
    if (result.error === "not_found") {
      return jsonResponse({ success: false, error: "Check-in not found", checkin_id: checkinId }, 404);
    }
    if (result.error === "collision") {
      return jsonResponse(
        {
          success: false,
          error: `Would collide with existing check-in ${result.collidingId} at week_start ${payload.week_start}`,
          colliding_checkin_id: result.collidingId,
        },
        409
      );
    }
    return jsonResponse({ success: true, checkin_id: result.checkin_id, updated: true }, 200);
  } catch (e) {
    return jsonResponse({ success: false, error: `Database error: ${e.message}` }, 500);
  }
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const filters = {
    week_start: url.searchParams.get("week_start") || undefined,
    start_date: url.searchParams.get("start_date") || undefined,
    end_date: url.searchParams.get("end_date") || undefined,
    limit: url.searchParams.get("limit") || undefined,
    slots_only: url.searchParams.get("slots_only") === "true",
  };

  if (filters.slots_only && !filters.week_start) {
    return jsonResponse({ success: false, error: "slots_only requires week_start" }, 400);
  }

  try {
    const result = await queryWeeklyCheckins(env, filters);
    if (filters.slots_only) {
      // result shape: { week_start, checkin_id, slots }
      return jsonResponse({ success: true, ...result }, 200);
    }
    // result shape: array of check-in rows
    return jsonResponse({ success: true, checkins: result }, 200);
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
