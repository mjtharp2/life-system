#!/usr/bin/env node
// Backfill script: read YAML session logs, POST to the training-log API.
//
// Usage:
//   node scripts/backfill-training-log.js --input scripts/backfill-yamls/ --dry-run
//   node scripts/backfill-training-log.js --input scripts/backfill-yamls/ --token "<bearer>"
//   TRAINING_LOG_TOKEN=<bearer> node scripts/backfill-training-log.js --input scripts/backfill-yamls/
//
// Flags:
//   --input <path>     Directory containing .yaml files (required)
//   --token <value>    Bearer token (or read from TRAINING_LOG_TOKEN env var)
//   --dry-run          Parse and validate without POSTing
//   --skip-existing    On 409, log and continue (treat as success)
//   --only <pattern>   Only process files matching this substring (for testing one session)
//   --limit <n>        Stop after processing n files

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import yaml from "js-yaml";

const ENDPOINT = "https://plain-hill-28ab.mjtharp2.workers.dev/api/training-log/sessions";
const FAILURES_DIR = "scripts/backfill-failures";

function parseArgs(argv) {
  const args = { dryRun: false, skipExisting: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i];
    else if (a === "--token") args.token = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--skip-existing") args.skipExisting = true;
    else if (a === "--only") args.only = argv[++i];
    else if (a === "--limit") args.limit = parseInt(argv[++i], 10);
  }
  if (!args.input) {
    console.error("ERROR: --input <path> is required");
    process.exit(2);
  }
  args.token = args.token || process.env.TRAINING_LOG_TOKEN;
  if (!args.dryRun && !args.token) {
    console.error("ERROR: --token <value> or TRAINING_LOG_TOKEN env var is required for non-dry-run");
    process.exit(2);
  }
  return args;
}

function writeFailure(filename, reason, content) {
  if (!existsSync(FAILURES_DIR)) mkdirSync(FAILURES_DIR, { recursive: true });
  const target = join(FAILURES_DIR, filename);
  writeFileSync(target, `# Backfill failure: ${reason}\n# Source: ${filename}\n\n${content}`);
}

async function postSession(token, payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  const args = parseArgs(process.argv);
  let files = readdirSync(args.input)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  if (args.only) files = files.filter((f) => f.includes(args.only));
  if (args.limit) files = files.slice(0, args.limit);

  console.log(`Found ${files.length} YAML file(s) to process.`);
  if (args.dryRun) console.log("DRY RUN: will parse but not POST.\n");

  const stats = { ok: 0, exists: 0, failed: 0, dryRunValid: 0 };

  for (const file of files) {
    const path = join(args.input, file);
    const content = readFileSync(path, "utf8");
    let payload;
    try {
      payload = yaml.load(content);
    } catch (e) {
      console.log(`  FAIL  ${file}  parse error: ${e.message}`);
      writeFailure(file, `YAML parse: ${e.message}`, content);
      stats.failed++;
      continue;
    }

    // Normalize YAML-coerced Date objects back to YYYY-MM-DD strings.
    // js-yaml (YAML 1.1) auto-parses unquoted ISO dates into Date objects;
    // JSON.stringify would emit a full ISO datetime and the worker's
    // /^\d{4}-\d{2}-\d{2}$/ validator would reject it.
    const isoDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
    if (payload?.session?.date) payload.session.date = isoDate(payload.session.date);
    if (payload?.next_session?.date) payload.next_session.date = isoDate(payload.next_session.date);

    // Strict structural check — mirrors the worker's validateSessionPayload
    // so dry-run results actually predict real-run results.
    const dateOk = typeof payload?.session?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.session.date);
    const typeOk = typeof payload?.session?.type === "string" && payload.session.type.length > 0;
    if (!dateOk || !typeOk) {
      console.log(`  FAIL  ${file}  invalid session.date (must be YYYY-MM-DD string) or session.type`);
      writeFailure(file, "invalid required fields", content);
      stats.failed++;
      continue;
    }

    if (args.dryRun) {
      console.log(`  OK    ${file}  (parsed, ${payload.session.date} ${payload.session.type})`);
      stats.dryRunValid++;
      continue;
    }

    try {
      const { status, body } = await postSession(args.token, payload);
      if (status === 201 && body.success) {
        console.log(`  OK    ${file}  → ${body.session_id}`);
        stats.ok++;
      } else if (status === 409) {
        if (args.skipExisting) {
          console.log(`  SKIP  ${file}  already exists (session_id=${body.session_id})`);
          stats.exists++;
        } else {
          console.log(`  FAIL  ${file}  409 (use --skip-existing to ignore): ${body.error}`);
          writeFailure(file, `409: ${body.error}`, content);
          stats.failed++;
        }
      } else {
        console.log(`  FAIL  ${file}  HTTP ${status}: ${body.error || JSON.stringify(body)}`);
        writeFailure(file, `HTTP ${status}: ${body.error || ""}`, content);
        stats.failed++;
      }
    } catch (e) {
      console.log(`  FAIL  ${file}  network error: ${e.message}`);
      writeFailure(file, `network: ${e.message}`, content);
      stats.failed++;
    }
  }

  console.log("\n=== Summary ===");
  if (args.dryRun) {
    console.log(`Dry-run valid: ${stats.dryRunValid}`);
  } else {
    console.log(`Inserted:       ${stats.ok}`);
    console.log(`Already exists: ${stats.exists}`);
  }
  console.log(`Failed:         ${stats.failed}`);
  if (stats.failed > 0) {
    console.log(`Failed files written to ${FAILURES_DIR}/ for review.`);
  }
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
