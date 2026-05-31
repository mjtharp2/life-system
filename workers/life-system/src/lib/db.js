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
  const statements = buildSessionInsertStatements(env, sessionId, payload);
  await env.DB.batch(statements);
  return { session_id: sessionId };
}

/**
 * Replaces an existing session with a corrected full payload.
 * - Verifies the session exists by sessionId; returns { error: "not_found" } if not.
 * - If the new (date, type) differs from the current row's and would collide with a
 *   DIFFERENT existing session, returns { error: "collision", collidingId }.
 * - Otherwise, in a single D1 batch (atomic):
 *     DELETE FROM training_sessions WHERE id = ?      -- cascades to all children
 *     INSERT the new payload's rows under the SAME sessionId
 *   The session's identity (UUID) is preserved across the replacement.
 * Returns { session_id } on success.
 */
export async function replaceTrainingSession(env, sessionId, payload) {
  const existing = await env.DB.prepare(
    "SELECT id, date, type FROM training_sessions WHERE id = ?"
  ).bind(sessionId).first();
  if (!existing) return { error: "not_found" };

  const newDate = payload.session.date;
  const newType = payload.session.type;
  if (existing.date !== newDate || existing.type !== newType) {
    const collide = await env.DB.prepare(
      "SELECT id FROM training_sessions WHERE date = ? AND type = ? AND id != ?"
    ).bind(newDate, newType, sessionId).first();
    if (collide) return { error: "collision", collidingId: collide.id };
  }

  const deleteStmt = env.DB.prepare(
    "DELETE FROM training_sessions WHERE id = ?"
  ).bind(sessionId);
  const insertStmts = buildSessionInsertStatements(env, sessionId, payload);
  await env.DB.batch([deleteStmt, ...insertStmts]);
  return { session_id: sessionId };
}

/**
 * Builds the array of D1 statements that insert a session and all its children.
 * Shared by insertTrainingSession (fresh insert with a generated UUID) and
 * replaceTrainingSession (insert-after-delete with the existing UUID preserved).
 */
function buildSessionInsertStatements(env, sessionId, payload) {
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

  return statements;
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

// ─── Weekly check-ins ──────────────────────────────────────────────────────
// Schema in schema-weekly-checkins.sql. Same patterns as training_* fns above:
// UUID PK, batch insert, FK ON DELETE CASCADE, replace = atomic delete-then-insert.

/**
 * Validates a check-in payload structurally.
 * Returns { valid: true } or { valid: false, error: "message" }.
 */
export function validateCheckinPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload must be a JSON object" };
  }
  if (typeof payload.week_start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.week_start)) {
    return { valid: false, error: "week_start must be a YYYY-MM-DD string (Monday of planned week)" };
  }
  if (typeof payload.checkin_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.checkin_date)) {
    return { valid: false, error: "checkin_date must be a YYYY-MM-DD string" };
  }
  if (typeof payload.headline !== "string" || payload.headline.length === 0) {
    return { valid: false, error: "headline must be a non-empty string" };
  }
  if (payload.watchfors !== undefined && !Array.isArray(payload.watchfors)) {
    return { valid: false, error: "watchfors must be an array of strings" };
  }
  if (payload.training_slots !== undefined && !Array.isArray(payload.training_slots)) {
    return { valid: false, error: "training_slots must be an array" };
  }
  for (const [i, slot] of (payload.training_slots || []).entries()) {
    if (typeof slot.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(slot.day)) {
      return { valid: false, error: `training_slots[${i}].day must be YYYY-MM-DD` };
    }
  }
  return { valid: true };
}

/**
 * Inserts a check-in + its training slots into D1 atomically.
 * Returns { checkin_id } or throws on database error.
 * Caller should call findExistingCheckin first for week_start collision handling.
 */
export async function insertWeeklyCheckin(env, payload) {
  const checkinId = crypto.randomUUID();
  const statements = buildCheckinInsertStatements(env, checkinId, payload);
  await env.DB.batch(statements);
  return { checkin_id: checkinId };
}

/**
 * Replaces an existing check-in with a corrected full payload, preserving its
 * checkin_id (UUID). DELETE cascades to weekly_training_slots; INSERT re-lays
 * the new payload's slots. All in a single D1 batch.
 * Returns { checkin_id } on success, { error: "not_found" }, or
 * { error: "collision", collidingId } when changing week_start to one already
 * used by a different row.
 */
export async function replaceWeeklyCheckin(env, checkinId, payload) {
  const existing = await env.DB.prepare(
    "SELECT id, week_start FROM weekly_checkins WHERE id = ?"
  ).bind(checkinId).first();
  if (!existing) return { error: "not_found" };

  if (existing.week_start !== payload.week_start) {
    const collide = await env.DB.prepare(
      "SELECT id FROM weekly_checkins WHERE week_start = ? AND id != ?"
    ).bind(payload.week_start, checkinId).first();
    if (collide) return { error: "collision", collidingId: collide.id };
  }

  const deleteStmt = env.DB.prepare(
    "DELETE FROM weekly_checkins WHERE id = ?"
  ).bind(checkinId);
  const insertStmts = buildCheckinInsertStatements(env, checkinId, payload);
  await env.DB.batch([deleteStmt, ...insertStmts]);
  return { checkin_id: checkinId };
}

/**
 * Returns the existing checkin_id for the given week_start, or null.
 */
export async function findExistingCheckin(env, weekStart) {
  const result = await env.DB.prepare(
    "SELECT id FROM weekly_checkins WHERE week_start = ?"
  ).bind(weekStart).first();
  return result ? result.id : null;
}

/**
 * Queries check-ins with optional filters. Returns check-ins with training
 * slots joined. Two modes:
 *   - Default: returns an array of check-in rows (each with `training_slots` array).
 *   - slots_only: with `week_start`, returns the single check-in's slots only —
 *     trainer's fast-path one-call read. Returns { week_start, checkin_id, slots }.
 */
export async function queryWeeklyCheckins(env, filters = {}) {
  const { week_start, start_date, end_date, limit = 4, slots_only = false } = filters;
  const clampedLimit = Math.min(Math.max(parseInt(limit, 10) || 4, 1), 20);

  // Slots-only fast path
  if (slots_only) {
    if (!week_start) throw new Error("slots_only requires week_start");
    const checkin = await env.DB.prepare(
      "SELECT id FROM weekly_checkins WHERE week_start = ?"
    ).bind(week_start).first();
    if (!checkin) return { week_start, checkin_id: null, slots: [] };
    const slotsResult = await env.DB.prepare(
      "SELECT * FROM weekly_training_slots WHERE checkin_id = ? ORDER BY order_in_week, day, time"
    ).bind(checkin.id).all();
    return { week_start, checkin_id: checkin.id, slots: slotsResult.results || [] };
  }

  // Full query
  const where = [];
  const bindings = [];
  if (week_start) { where.push("week_start = ?"); bindings.push(week_start); }
  if (start_date) { where.push("week_start >= ?"); bindings.push(start_date); }
  if (end_date) { where.push("week_start <= ?"); bindings.push(end_date); }
  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  const checkinsResult = await env.DB.prepare(
    `SELECT * FROM weekly_checkins ${whereClause} ORDER BY week_start DESC LIMIT ?`
  ).bind(...bindings, clampedLimit).all();

  const checkins = checkinsResult.results || [];
  if (checkins.length === 0) return [];

  const ids = checkins.map((c) => c.id);
  const placeholders = ids.map(() => "?").join(",");
  const slotsResult = await env.DB.prepare(
    `SELECT * FROM weekly_training_slots WHERE checkin_id IN (${placeholders}) ORDER BY checkin_id, order_in_week, day, time`
  ).bind(...ids).all();

  const slotsByCheckin = {};
  for (const s of slotsResult.results || []) {
    (slotsByCheckin[s.checkin_id] ||= []).push(s);
  }

  return checkins.map((c) => ({
    ...c,
    watchfors: c.watchfors ? JSON.parse(c.watchfors) : [],
    training_slots: slotsByCheckin[c.id] || [],
  }));
}

/**
 * Builds the array of D1 statements that insert a check-in and its training slots.
 * Shared by insertWeeklyCheckin (fresh insert) and replaceWeeklyCheckin
 * (insert-after-delete with preserved checkin_id).
 */
function buildCheckinInsertStatements(env, checkinId, payload) {
  const now = new Date().toISOString();
  const statements = [];

  statements.push(env.DB.prepare(`
    INSERT INTO weekly_checkins (
      id, week_start, checkin_date,
      sleep_avg_7d, regulation_events, workout_adherence, stimulant_contract, operating_mode,
      headline, watchfors, narrative_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    checkinId,
    payload.week_start,
    payload.checkin_date,
    payload.sleep_avg_7d ?? null,
    payload.regulation_events ?? null,
    payload.workout_adherence ?? null,
    payload.stimulant_contract ?? null,
    payload.operating_mode ?? null,
    payload.headline ?? null,
    JSON.stringify(payload.watchfors || []),
    payload.narrative_path ?? null,
    now
  ));

  for (const [i, slot] of (payload.training_slots || []).entries()) {
    statements.push(env.DB.prepare(`
      INSERT INTO weekly_training_slots (id, checkin_id, day, time, category, constraint_note, order_in_week)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      checkinId,
      slot.day,
      slot.time ?? null,
      slot.category ?? null,
      // Accept either `constraint_note` or `constraint` from callers — DB stores under constraint_note.
      slot.constraint_note ?? slot.constraint ?? null,
      slot.order_in_week ?? i
    ));
  }

  return statements;
}
