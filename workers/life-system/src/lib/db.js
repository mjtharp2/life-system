// Shared database helpers for the training-log substrate.
// Used by both the HTTP routes (src/routes/training-log.js) and
// future MCP tools (src/mcp/...) per the architecture brief.

/**
 * Validates a session payload structurally.
 * Returns { valid: true } or { valid: false, error: "message" }.
 */
export function validateSessionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload must be a JSON object" };
  }
  const session = payload.session;
  if (!session || typeof session !== "object") {
    return { valid: false, error: "Missing required 'session' block" };
  }
  if (typeof session.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
    return { valid: false, error: "session.date must be a YYYY-MM-DD string" };
  }
  if (typeof session.type !== "string" || session.type.length === 0) {
    return { valid: false, error: "session.type must be a non-empty string" };
  }
  if (typeof session.day !== "string") {
    return { valid: false, error: "session.day must be a string (mon|tue|...|sun)" };
  }
  if (payload.lifts !== undefined && !Array.isArray(payload.lifts)) {
    return { valid: false, error: "lifts must be an array" };
  }
  if (payload.cardio !== undefined && !Array.isArray(payload.cardio)) {
    return { valid: false, error: "cardio must be an array" };
  }
  if (payload.flags !== undefined && !Array.isArray(payload.flags)) {
    return { valid: false, error: "flags must be an array" };
  }
  for (const [i, lift] of (payload.lifts || []).entries()) {
    if (!lift.name || typeof lift.name !== "string") {
      return { valid: false, error: `lifts[${i}].name is required` };
    }
    if (!lift.category || typeof lift.category !== "string") {
      return { valid: false, error: `lifts[${i}].category is required` };
    }
    if (lift.sets !== undefined && !Array.isArray(lift.sets)) {
      return { valid: false, error: `lifts[${i}].sets must be an array` };
    }
  }
  return { valid: true };
}

/**
 * Inserts a session and all its children into D1 atomically.
 * Returns { success: true, session_id } or throws on database error.
 * Caller should handle UNIQUE constraint violations (return 409).
 */
export async function insertTrainingSession(env, payload) {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const s = payload.session;
  const r = payload.readiness || {};
  const t = payload.tirzepatide || {};
  const sm = payload.summary || {};
  const ns = payload.next_session || {};

  const statements = [];

  statements.push(env.DB.prepare(`
    INSERT INTO training_sessions (
      id, date, day, type, phase, duration_min, location, travel,
      energy, sleep_hours, hrv, rhr, pec_baseline, readiness_notes,
      weeks_since_first_dose, weeks_since_last_escalation, current_dose_mg, appetite, gi_symptoms,
      summary_what_moved_up, summary_what_held, summary_what_dropped, summary_notable,
      next_session_date, next_session_day, next_session_type, next_session_notes, next_session_hints,
      schema_version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId, s.date, s.day, s.type, s.phase ?? null, s.duration_min ?? null,
    s.location ?? null, s.travel ? 1 : 0,
    r.energy ?? null, r.sleep_hours ?? null, r.hrv ?? null, r.rhr ?? null, r.pec_baseline ?? null, r.notes ?? null,
    t.weeks_since_first_dose ?? null, t.weeks_since_last_escalation ?? null, t.current_dose_mg ?? null,
    t.appetite ?? null, t.gi_symptoms ? 1 : 0,
    JSON.stringify(sm.what_moved_up || []), JSON.stringify(sm.what_held || []),
    JSON.stringify(sm.what_dropped || []), sm.notable ?? null,
    ns.date ?? null, ns.day ?? null, ns.type ?? null, ns.notes ?? null,
    JSON.stringify(ns.prescription_hints || []),
    payload.schema_version || "1.0", now
  ));

  for (const [i, lift] of (payload.lifts || []).entries()) {
    const liftId = crypto.randomUUID();
    statements.push(env.DB.prepare(`
      INSERT INTO training_lift_entries (id, session_id, order_in_session, name, category, pec_engagement, progression, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(liftId, sessionId, i, lift.name, lift.category, lift.pec_engagement ?? null, lift.progression ?? null, lift.notes ?? null));
    for (const [j, set] of (lift.sets || []).entries()) {
      statements.push(env.DB.prepare(`
        INSERT INTO training_sets (id, lift_entry_id, set_number, weight, reps, rpe, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), liftId, j + 1, set.weight ?? null, set.reps ?? null, set.rpe ?? null, set.note ?? null));
    }
  }

  for (const [i, c] of (payload.cardio || []).entries()) {
    statements.push(env.DB.prepare(`
      INSERT INTO training_cardio_entries (id, session_id, order_in_session, modality, type, duration_min, avg_hr, rpe, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), sessionId, i, c.modality ?? null, c.type ?? null, c.duration_min ?? null,
      c.avg_hr ?? null, c.rpe ?? null, c.notes ?? null));
  }

  for (const [i, f] of (payload.flags || []).entries()) {
    statements.push(env.DB.prepare(`
      INSERT INTO training_flags (id, session_id, order_in_session, type, detail)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), sessionId, i, f.type ?? null, f.detail ?? null));
  }

  await env.DB.batch(statements);
  return { session_id: sessionId };
}

/**
 * Checks whether a session already exists for (date, type).
 * Returns the existing session_id if found, or null.
 */
export async function findExistingSession(env, date, type) {
  const result = await env.DB.prepare(
    "SELECT id FROM training_sessions WHERE date = ? AND type = ?"
  ).bind(date, type).first();
  return result ? result.id : null;
}

/**
 * Queries sessions with optional filters, returns sessions with joined children.
 */
export async function queryTrainingSessions(env, filters = {}) {
  const { start_date, end_date, session_tag, lift_name, limit = 20 } = filters;
  const clampedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  // Build WHERE clause dynamically
  const where = [];
  const bindings = [];
  if (start_date) { where.push("s.date >= ?"); bindings.push(start_date); }
  if (end_date) { where.push("s.date <= ?"); bindings.push(end_date); }
  if (session_tag) { where.push("s.type = ?"); bindings.push(session_tag); }

  // For lift_name filter, only return sessions that contain that lift
  let lift_filter = "";
  if (lift_name) {
    lift_filter = " AND s.id IN (SELECT session_id FROM training_lift_entries WHERE name = ?)";
    bindings.push(lift_name);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") + lift_filter : (lift_filter ? "WHERE 1=1" + lift_filter : "");

  const sessionsResult = await env.DB.prepare(
    `SELECT * FROM training_sessions s ${whereClause} ORDER BY s.date DESC LIMIT ?`
  ).bind(...bindings, clampedLimit).all();

  const sessions = sessionsResult.results || [];
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const placeholders = ids.map(() => "?").join(",");

  const liftsResult = await env.DB.prepare(
    `SELECT * FROM training_lift_entries WHERE session_id IN (${placeholders}) ORDER BY order_in_session`
  ).bind(...ids).all();
  const setsResult = await env.DB.prepare(
    `SELECT s.* FROM training_sets s JOIN training_lift_entries le ON s.lift_entry_id = le.id WHERE le.session_id IN (${placeholders}) ORDER BY s.set_number`
  ).bind(...ids).all();
  const cardioResult = await env.DB.prepare(
    `SELECT * FROM training_cardio_entries WHERE session_id IN (${placeholders}) ORDER BY order_in_session`
  ).bind(...ids).all();
  const flagsResult = await env.DB.prepare(
    `SELECT * FROM training_flags WHERE session_id IN (${placeholders}) ORDER BY order_in_session`
  ).bind(...ids).all();

  // Build lookup maps
  const liftsBySession = {};
  const liftIdToSession = {};
  for (const lift of liftsResult.results || []) {
    (liftsBySession[lift.session_id] ||= []).push({ ...lift, sets: [] });
    liftIdToSession[lift.id] = lift.session_id;
  }
  for (const set of setsResult.results || []) {
    const sessionId = liftIdToSession[set.lift_entry_id];
    if (!sessionId) continue;
    const lift = (liftsBySession[sessionId] || []).find((l) => l.id === set.lift_entry_id);
    if (lift) lift.sets.push(set);
  }
  const cardioBySession = {};
  for (const c of cardioResult.results || []) {
    (cardioBySession[c.session_id] ||= []).push(c);
  }
  const flagsBySession = {};
  for (const f of flagsResult.results || []) {
    (flagsBySession[f.session_id] ||= []).push(f);
  }

  // Assemble
  return sessions.map((s) => ({
    ...s,
    summary_what_moved_up: s.summary_what_moved_up ? JSON.parse(s.summary_what_moved_up) : [],
    summary_what_held: s.summary_what_held ? JSON.parse(s.summary_what_held) : [],
    summary_what_dropped: s.summary_what_dropped ? JSON.parse(s.summary_what_dropped) : [],
    next_session_hints: s.next_session_hints ? JSON.parse(s.next_session_hints) : [],
    lifts: liftsBySession[s.id] || [],
    cardio: cardioBySession[s.id] || [],
    flags: flagsBySession[s.id] || [],
  }));
}
