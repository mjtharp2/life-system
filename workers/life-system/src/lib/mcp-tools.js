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
  findExistingSession,
  queryTrainingSessions,
} from "./db.js";

// ─── Zod parsers (runtime arg validation) ──────────────────────────────────
// db.js owns structural validation of the session payload (the canonical
// source of truth). Zod here is the outer wrapper that catches argument-shape
// errors before we touch the database.

const WriteSessionArgsZ = z.object({
  session_data: z.record(z.string(), z.unknown()).describe("Full session payload — see tool description for fields"),
}).strict();

const QueryLogArgsZ = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD").optional(),
  session_tag: z.string().min(1).optional(),
  lift_name: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
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

// ─── Aggregate registry ────────────────────────────────────────────────────
// Future domains: import their tool array and spread it in below.
export const TOOLS = [...trainingTools];

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
