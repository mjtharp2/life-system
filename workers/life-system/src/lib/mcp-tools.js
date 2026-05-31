// MCP tool registry for the life-system substrate.
//
// Each tool: { name, title, description, annotations, inputSchema (JSON Schema
// for the wire), parser (Zod schema for runtime arg validation), handler }.
// Handlers receive validated args and the worker env, and return an MCP
// `tools/call` result object: { content: [...], structuredContent?, isError? }.
//
// Adding a new domain: create a sibling file (e.g. mcp-tools-todoist.js) that
// exports a list of tool definitions in this shape, import it here, and spread
// it into TOOLS below. No dispatch refactor required.

import { z } from "zod";
import {
  validateSessionPayload,
  insertTrainingSession,
  replaceTrainingSession,
  findExistingSession,
  queryTrainingSessions,
  validateCheckinPayload,
  insertWeeklyCheckin,
  replaceWeeklyCheckin,
  findExistingCheckin,
  queryWeeklyCheckins,
} from "./db.js";

// ─── Zod parsers (runtime arg validation) ──────────────────────────────────
// db.js owns structural validation of the session payload (the canonical
// source of truth). Zod here is the outer wrapper that catches argument-shape
// errors before we touch the database.

const WriteSessionArgsZ = z.object({
  session_data: z.record(z.string(), z.unknown()).describe("Full session payload — see tool description for fields"),
}).strict();

const UpdateSessionArgsZ = z.object({
  session_id: z.string().uuid("session_id must be a UUID returned by training_write_session or training_query_log"),
  session_data: z.record(z.string(), z.unknown()).describe("Full corrected session payload — see tool description for fields"),
}).strict();

const QueryLogArgsZ = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD").optional(),
  session_tag: z.string().min(1).optional(),
  lift_name: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
}).strict();

const WriteCheckinArgsZ = z.object({
  checkin_data: z.record(z.string(), z.unknown()).describe("Full check-in payload — see tool description for fields"),
}).strict();

const UpdateCheckinArgsZ = z.object({
  checkin_id: z.string().uuid("checkin_id must be a UUID returned by weekly_write_checkin or weekly_query_checkin"),
  checkin_data: z.record(z.string(), z.unknown()).describe("Full corrected check-in payload — see tool description for fields"),
}).strict();

const QueryCheckinArgsZ = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "week_start must be YYYY-MM-DD").optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD").optional(),
  limit: z.number().int().min(1).max(20).default(4),
  slots_only: z.boolean().default(false),
}).strict();

// ─── JSON Schemas (wire format for tools/list) ─────────────────────────────
// Hand-built rather than auto-derived from Zod so the descriptions surfaced to
// the model are tuned for tool-calling rather than generic schema docs.

const writeSessionInputSchema = {
  type: "object",
  required: ["session_data"],
  additionalProperties: false,
  properties: {
    session_data: {
      type: "object",
      description: "Full session payload. Required: session.date (YYYY-MM-DD), session.day (mon|tue|wed|thu|fri|sat|sun), session.type (slug). Optional blocks: readiness, tirzepatide, summary, next_session, lifts[], cardio[], flags[], schema_version. See tool description for nested field shapes.",
      required: ["session"],
      additionalProperties: true,
      properties: {
        session: {
          type: "object",
          required: ["date", "day", "type"],
          additionalProperties: true,
          properties: {
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "YYYY-MM-DD" },
            day: { type: "string", description: "mon|tue|wed|thu|fri|sat|sun" },
            type: { type: "string", minLength: 1, description: "Session type slug, e.g. 'upper_push_pec_rehab', 'cardio_zone2', 'tennis', 'mobility'" },
            phase: { type: "string" },
            duration_min: { type: "number" },
            location: { type: "string" },
            travel: { type: "boolean" },
          },
        },
        readiness: { type: "object", additionalProperties: true, description: "energy, sleep_hours, hrv, rhr, pec_baseline, notes" },
        tirzepatide: { type: "object", additionalProperties: true, description: "weeks_since_first_dose, weeks_since_last_escalation, current_dose_mg, appetite, gi_symptoms" },
        summary: { type: "object", additionalProperties: true, description: "what_moved_up[], what_held[], what_dropped[], notable" },
        next_session: { type: "object", additionalProperties: true, description: "date, day, type, notes, prescription_hints[]" },
        lifts: {
          type: "array",
          description: "Each: { name, category, pec_engagement?, progression?, notes?, sets: [{weight, reps, rpe, note}] }",
          items: { type: "object", additionalProperties: true },
        },
        cardio: {
          type: "array",
          description: "Each: { modality, type, duration_min, avg_hr, rpe, notes }",
          items: { type: "object", additionalProperties: true },
        },
        flags: {
          type: "array",
          description: "Each: { type, detail }",
          items: { type: "object", additionalProperties: true },
        },
        schema_version: { type: "string", description: "Defaults to '1.0'" },
      },
    },
  },
};

const updateSessionInputSchema = {
  type: "object",
  required: ["session_id", "session_data"],
  additionalProperties: false,
  properties: {
    session_id: {
      type: "string",
      format: "uuid",
      description: "The UUID returned by training_write_session (or surfaced by training_query_log) identifying the session to replace.",
    },
    session_data: writeSessionInputSchema.properties.session_data,
  },
};

const queryLogInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    start_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Inclusive lower bound YYYY-MM-DD" },
    end_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Inclusive upper bound YYYY-MM-DD" },
    session_tag: { type: "string", description: "Filter by session.type (exact match), e.g. 'cardio_zone2'" },
    lift_name: { type: "string", description: "Only return sessions that contain this lift name (exact match)" },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20, description: "Maximum sessions to return (default 20)" },
  },
};

const writeCheckinInputSchema = {
  type: "object",
  required: ["checkin_data"],
  additionalProperties: false,
  properties: {
    checkin_data: {
      type: "object",
      description: "Full check-in payload. Required: week_start (YYYY-MM-DD, Monday of planned week), checkin_date (YYYY-MM-DD), headline (one-line week summary). All other fields optional; see properties below.",
      required: ["week_start", "checkin_date", "headline"],
      additionalProperties: true,
      properties: {
        week_start: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Monday of the planned week (YYYY-MM-DD). UNIQUE — one check-in per week." },
        checkin_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "When the check-in was actually done." },
        sleep_avg_7d: { type: "number", description: "Apple Health / Oura 7-day sleep score average for the week being reviewed." },
        regulation_events: { type: "string", description: "'none' | 'level_1' | 'level_2' | 'level_3' | short description." },
        workout_adherence: { type: "string", description: "Qualitative free-text (e.g. 'solid', 'excellent', 'missed 2')." },
        stimulant_contract: { type: "string", description: "'held' | 'wavered_once' | 'wavered_multiple' | 'not_recorded'." },
        operating_mode: { type: "string", description: "Short framing label, e.g. 'pressed', 'travel', 'recovery'." },
        headline: { type: "string", minLength: 1, description: "One-line week summary." },
        watchfors: {
          type: "array",
          items: { type: "string" },
          description: "Short slug strings carried into next week's backward review.",
        },
        narrative_path: { type: "string", description: "Relative path to the markdown entry, e.g. 'weekly_log/2026-06-01.md'." },
        training_slots: {
          type: "array",
          description: "Trainer-bridge contract: the agreed training slots for the week. Each slot a hint for the trainer planner.",
          items: {
            type: "object",
            required: ["day"],
            additionalProperties: true,
            properties: {
              day: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "ISO YYYY-MM-DD (the specific date the slot is for)." },
              time: { type: "string", description: "e.g. '06:00' or 'evening'." },
              category: { type: "string", description: "lift | cardio | tennis | mobility | rest." },
              constraint_note: { type: "string", description: "e.g. '45min cap', 'hotel/no equipment', 'lower-impact: achilles'." },
              order_in_week: { type: "integer", description: "0-indexed display order. Defaults to array position." },
            },
          },
        },
      },
    },
  },
};

const updateCheckinInputSchema = {
  type: "object",
  required: ["checkin_id", "checkin_data"],
  additionalProperties: false,
  properties: {
    checkin_id: {
      type: "string",
      format: "uuid",
      description: "The UUID returned by weekly_write_checkin (or surfaced by weekly_query_checkin) identifying the check-in to replace.",
    },
    checkin_data: writeCheckinInputSchema.properties.checkin_data,
  },
};

const queryCheckinInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    week_start: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Filter to one specific week (its Monday date)." },
    start_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Inclusive lower bound on week_start." },
    end_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Inclusive upper bound on week_start." },
    limit: { type: "integer", minimum: 1, maximum: 20, default: 4, description: "Maximum check-ins to return (default 4)." },
    slots_only: { type: "boolean", default: false, description: "Trainer fast-path. Requires week_start. Returns { week_start, checkin_id, slots } — just the slot array, not the full check-in." },
  },
};

// ─── Training domain tools ─────────────────────────────────────────────────

const trainingTools = [
  {
    name: "training_write_session",
    title: "Write Training Session",
    description: `Insert a single training session into the life-system training log.

Idempotent at the (date, type) key: if a session for the same date and type already exists, returns the existing session_id without inserting.

Args:
  session_data (object): Full session payload.
    Required:
      - session.date (string, YYYY-MM-DD)
      - session.day (string, mon|tue|wed|thu|fri|sat|sun)
      - session.type (string, slug like 'upper_push_pec_rehab', 'cardio_zone2', 'tennis', 'mobility')
    Optional top-level blocks:
      - session.{phase, duration_min, location, travel}
      - readiness: { energy, sleep_hours, hrv, rhr, pec_baseline, notes }
      - tirzepatide: { weeks_since_first_dose, weeks_since_last_escalation, current_dose_mg, appetite, gi_symptoms }
      - summary: { what_moved_up[], what_held[], what_dropped[], notable }
      - next_session: { date, day, type, notes, prescription_hints[] }
      - lifts[]: each { name, category, pec_engagement?, progression?, notes?, sets: [{weight, reps, rpe, note}] }
      - cardio[]: each { modality, type, duration_min, avg_hr, rpe, notes }
      - flags[]: each { type, detail }
      - schema_version (string, defaults to '1.0')

Returns:
  { "session_id": "<uuid>", "created": true }                              on fresh insert
  { "session_id": "<uuid>", "created": false, "reason": "already_exists" } when (date, type) already exists

Errors:
  - "Invalid session payload: <reason>" — structural validation failed
  - "Database error: <reason>" — D1 write failed`,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: writeSessionInputSchema,
    parser: WriteSessionArgsZ,
    async handler(args, env) {
      const payload = args.session_data;
      const validation = validateSessionPayload(payload);
      if (!validation.valid) {
        return errorResult(`Invalid session payload: ${validation.error}`);
      }
      const existingId = await findExistingSession(env, payload.session.date, payload.session.type);
      if (existingId) {
        return okResult({ session_id: existingId, created: false, reason: "already_exists" });
      }
      try {
        const { session_id } = await insertTrainingSession(env, payload);
        return okResult({ session_id, created: true });
      } catch (e) {
        return errorResult(`Database error: ${e.message}`);
      }
    },
  },
  {
    name: "training_update_session",
    title: "Update Training Session",
    description: `Replace an existing training session with a corrected full payload.

Use this when the user corrects something about a session that was already written — wrong weight, missing set, missed flag, mislabeled date, etc. The trainer typically calls this after the user surfaces a correction in the same conversation that wrote the session.

Full-replace semantics: the existing session's lifts, sets, cardio entries, and flags are deleted, and the new payload's contents are inserted in their place — atomically, in a single D1 batch (transaction). The session_id (UUID) is preserved across the replacement; the row identity does not change. Other sessions are unaffected.

Args:
  session_id (string, UUID): The session_id returned by training_write_session (or surfaced by training_query_log) for the session to replace.
  session_data (object): Full corrected session payload. Same shape as training_write_session — see that tool's description for required and optional fields. The new payload's (date, type) may differ from the original; if so, the new (date, type) must not collide with any other existing session.

Returns:
  { "session_id": "<uuid>", "updated": true }

Errors:
  - "Invalid session payload: <reason>" — structural validation failed
  - "Session not found: <session_id>" — no session row with that ID
  - "Would collide with existing session <other_uuid> at (<date>, <type>)" — new (date, type) is already taken by a different session
  - "Database error: <reason>" — D1 batch failed`,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: updateSessionInputSchema,
    parser: UpdateSessionArgsZ,
    async handler(args, env) {
      const { session_id, session_data } = args;
      const validation = validateSessionPayload(session_data);
      if (!validation.valid) {
        return errorResult(`Invalid session payload: ${validation.error}`);
      }
      try {
        const result = await replaceTrainingSession(env, session_id, session_data);
        if (result.error === "not_found") {
          return errorResult(`Session not found: ${session_id}`);
        }
        if (result.error === "collision") {
          return errorResult(`Would collide with existing session ${result.collidingId} at (${session_data.session.date}, ${session_data.session.type})`);
        }
        return okResult({ session_id: result.session_id, updated: true });
      } catch (e) {
        return errorResult(`Database error: ${e.message}`);
      }
    },
  },
  {
    name: "training_query_log",
    title: "Query Training Log",
    description: `Query training sessions with optional filters. Read-only.

Returns sessions in date-descending order with joined lifts (and their sets), cardio entries, and flags fully inlined.

Args:
  start_date (string, optional): Inclusive lower bound YYYY-MM-DD
  end_date (string, optional): Inclusive upper bound YYYY-MM-DD
  session_tag (string, optional): Filter by session.type (exact match), e.g. 'cardio_zone2'
  lift_name (string, optional): Only return sessions that contain this lift name (exact match)
  limit (integer, optional): Max sessions to return, 1-100, default 20

Returns:
  { "sessions": [
      {
        id, date, day, type, phase, duration_min, location, travel,
        energy, sleep_hours, hrv, rhr, pec_baseline, readiness_notes,
        weeks_since_first_dose, weeks_since_last_escalation, current_dose_mg, appetite, gi_symptoms,
        summary_what_moved_up: [...], summary_what_held: [...], summary_what_dropped: [...], summary_notable,
        next_session_date, next_session_day, next_session_type, next_session_notes, next_session_hints: [...],
        schema_version, created_at,
        lifts: [{ id, session_id, order_in_session, name, category, pec_engagement, progression, notes,
                  sets: [{ id, lift_entry_id, set_number, weight, reps, rpe, note }] }],
        cardio: [{ id, session_id, order_in_session, modality, type, duration_min, avg_hr, rpe, notes }],
        flags:  [{ id, session_id, order_in_session, type, detail }]
      },
      ...
    ]
  }
  Returns { "sessions": [] } if no matches.`,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: queryLogInputSchema,
    parser: QueryLogArgsZ,
    async handler(args, env) {
      try {
        const sessions = await queryTrainingSessions(env, args);
        return okResult({ sessions });
      } catch (e) {
        return errorResult(`Database error: ${e.message}`);
      }
    },
  },
];

// ─── Weekly check-in domain tools ──────────────────────────────────────────

const weeklyTools = [
  {
    name: "weekly_write_checkin",
    title: "Write Weekly Check-In",
    description: `Insert a weekly check-in row plus its agreed training slots into the substrate.

Use this after completing a weekly check-in conversation. The narrative lives in weekly_log/YYYY-MM-DD.md; this row holds the queryable signals + the trainer-bridge contract (training_slots).

Unique key is (week_start) — one check-in per planned week. Re-running for the same week is plausible: collisions return the existing checkin_id; call weekly_update_checkin to replace, not weekly_write_checkin again.

Args:
  checkin_data (object): Full check-in payload.
    Required:
      - week_start (string, YYYY-MM-DD): Monday of the planned week. UNIQUE key.
      - checkin_date (string, YYYY-MM-DD): when the check-in was done.
      - headline (string): one-line week summary.
    Optional:
      - sleep_avg_7d (number): Apple Health / Oura 7-day sleep avg for the prior week
      - regulation_events (string): 'none' | 'level_1' | 'level_2' | 'level_3' | freeform
      - workout_adherence (string): qualitative
      - stimulant_contract (string): 'held' | 'wavered_once' | 'wavered_multiple' | 'not_recorded'
      - operating_mode (string): short framing, e.g. 'pressed', 'travel'
      - watchfors (string[]): slugs carried into next week's backward review
      - narrative_path (string): relative path to weekly_log/<file>.md
      - training_slots[]: each { day (YYYY-MM-DD), time?, category?, constraint_note?, order_in_week? }

Returns:
  { "checkin_id": "<uuid>", "week_start": "<date>", "created": true }                              on fresh insert
  { "checkin_id": "<uuid>", "week_start": "<date>", "created": false, "reason": "already_exists" } when week_start already used

Errors:
  - "Invalid check-in payload: <reason>" — structural validation failed
  - "Database error: <reason>" — D1 write failed`,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: writeCheckinInputSchema,
    parser: WriteCheckinArgsZ,
    async handler(args, env) {
      const payload = args.checkin_data;
      const validation = validateCheckinPayload(payload);
      if (!validation.valid) {
        return errorResult(`Invalid check-in payload: ${validation.error}`);
      }
      const existingId = await findExistingCheckin(env, payload.week_start);
      if (existingId) {
        return okResult({ checkin_id: existingId, week_start: payload.week_start, created: false, reason: "already_exists" });
      }
      try {
        const { checkin_id } = await insertWeeklyCheckin(env, payload);
        return okResult({ checkin_id, week_start: payload.week_start, created: true });
      } catch (e) {
        return errorResult(`Database error: ${e.message}`);
      }
    },
  },
  {
    name: "weekly_update_checkin",
    title: "Update Weekly Check-In",
    description: `Replace an existing weekly check-in (and its training slots) with a corrected full payload.

Full-replace semantics: existing training_slots are deleted and the new payload's contents are inserted in their place — atomically, in a single D1 batch. The checkin_id (UUID) is preserved across the replacement. Other check-ins are unaffected.

Use this when:
  - A check-in needs amending after the fact (correction surfaced post-write).
  - A weekly check-in is being re-run for the same week.

Args:
  checkin_id (string, UUID): The checkin_id returned by weekly_write_checkin (or surfaced by weekly_query_checkin).
  checkin_data (object): Full corrected check-in payload — same shape as weekly_write_checkin. The new payload's week_start may differ from the original; if so, it must not collide with another existing check-in.

Returns:
  { "checkin_id": "<uuid>", "updated": true }

Errors:
  - "Invalid check-in payload: <reason>"
  - "Check-in not found: <checkin_id>"
  - "Would collide with existing check-in <other_uuid> at week_start <date>"
  - "Database error: <reason>"`,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: updateCheckinInputSchema,
    parser: UpdateCheckinArgsZ,
    async handler(args, env) {
      const { checkin_id, checkin_data } = args;
      const validation = validateCheckinPayload(checkin_data);
      if (!validation.valid) {
        return errorResult(`Invalid check-in payload: ${validation.error}`);
      }
      try {
        const result = await replaceWeeklyCheckin(env, checkin_id, checkin_data);
        if (result.error === "not_found") {
          return errorResult(`Check-in not found: ${checkin_id}`);
        }
        if (result.error === "collision") {
          return errorResult(`Would collide with existing check-in ${result.collidingId} at week_start ${checkin_data.week_start}`);
        }
        return okResult({ checkin_id: result.checkin_id, updated: true });
      } catch (e) {
        return errorResult(`Database error: ${e.message}`);
      }
    },
  },
  {
    name: "weekly_query_checkin",
    title: "Query Weekly Check-Ins",
    description: `Query weekly check-ins with optional filters. Read-only.

Two modes:
  - Default (full): returns check-in rows with training_slots fully joined.
  - slots_only (trainer fast-path): with week_start, returns ONLY the slots array
    for that week — one call, no join assembly on the caller's side.

Args:
  week_start (string, YYYY-MM-DD, optional): filter to one specific week.
  start_date (string, YYYY-MM-DD, optional): inclusive lower bound on week_start.
  end_date (string, YYYY-MM-DD, optional): inclusive upper bound on week_start.
  limit (integer, optional): max check-ins to return, 1-20, default 4. Newest first.
  slots_only (boolean, optional, default false): trainer fast-path. Requires week_start.

Returns:
  Default:
    { "checkins": [
        { id, week_start, checkin_date, sleep_avg_7d, regulation_events, workout_adherence,
          stimulant_contract, operating_mode, headline, watchfors: [...], narrative_path, created_at,
          training_slots: [{ id, checkin_id, day, time, category, constraint_note, order_in_week }] },
        ...
      ]
    }
  slots_only:
    { "week_start": "<date>", "checkin_id": "<uuid>", "slots": [{...}, ...] }
    If no check-in exists for week_start: { "week_start": "<date>", "checkin_id": null, "slots": [] }

Errors:
  - "slots_only requires week_start" — slots_only=true without week_start
  - "Database error: <reason>"`,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: queryCheckinInputSchema,
    parser: QueryCheckinArgsZ,
    async handler(args, env) {
      try {
        if (args.slots_only && !args.week_start) {
          return errorResult("slots_only requires week_start");
        }
        const result = await queryWeeklyCheckins(env, args);
        if (args.slots_only) {
          return okResult(result);
        }
        return okResult({ checkins: result });
      } catch (e) {
        return errorResult(`Database error: ${e.message}`);
      }
    },
  },
];

// ─── Aggregate registry ────────────────────────────────────────────────────
// Future domains: import their tool array and spread it in below.
export const TOOLS = [...trainingTools, ...weeklyTools];

export function listToolsForClient() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  }));
}

export async function callTool(name, args, env) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { notFound: true };
  let parsed;
  try {
    parsed = tool.parser.parse(args || {});
  } catch (e) {
    return errorResult(`Invalid arguments for ${name}: ${formatZodError(e)}`);
  }
  return tool.handler(parsed, env);
}

// ─── Result helpers ────────────────────────────────────────────────────────

function okResult(structured) {
  return {
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function formatZodError(e) {
  if (e && Array.isArray(e.issues)) {
    return e.issues.map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`).join("; ");
  }
  return String((e && e.message) || e);
}
