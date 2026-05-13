// Daily tennis brief: Claude (with web search) → Resend → email.
// Runs on GitHub Actions. Cron is configured in the workflow YAML, not here.

const RECIPIENTS = ["mjtharp2@gmail.com", "lauren.j.tharp@gmail.com", "samuel.b.morgan0@gmail.com"];
const FROM = "tennis@mjtharp.com";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function getCentralDates() {
  const now = new Date();
  const longFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const shortFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return {
    long: longFmt.format(now),
    short: shortFmt.format(now),
  };
}

function buildPrompt(todayLong) {
  return `You are writing a daily tennis brief for Matt and Lauren, a couple in Chicago who are tennis fans. They follow ATP and WTA singles at the Grand Slam, Masters 1000, WTA 1000, ATP 500, and WTA 500 level.

Use web search to find the current state of any active tour-level events at those levels. One search per tour (ATP, WTA) is usually enough — look for tournament status pages that show both yesterday's results and today's order of play in one place. Limit yourself to 2-3 searches total; do not search for broadcast info, start times, or news beyond the matches themselves.

Output rules:
- If there are no active tour-level events at those levels (no matches yesterday and none today), respond with the single word SKIP and nothing else.
- Otherwise, write the brief in plain text (no markdown, no bullets unless natural). Open with "Matt and Lauren," and a sentence framing the day. Short paragraph on yesterday's notable results. Short paragraph on today's matches worth watching, headline storyline first.
- Be opinionated. Don't list everything — pick what matters. If Sinner-Alcaraz is on, that's the headline. If it's a quiet day at a 500, say so briefly and move on.
- When a tournament's final wrapped up yesterday, include a brief look-ahead to what's next on the calendar at the Slam, Masters 1000, or WTA 1000 level — name the next event and its start date if known.
- Do not include broadcast networks, streaming services, or match start times. Just the matches and what's interesting about them.
- No "Good morning" preamble beyond "Matt and Lauren,". No closing signoff. The brief ends when the content ends.
- Today's date is ${todayLong}.

IMPORTANT — Output format: wrap the final brief between <brief> and </brief> tags. Any reasoning, planning, or notes you produce should be outside these tags. Only the content between the tags will be sent. If you decide to SKIP, output exactly "<brief>SKIP</brief>" with nothing else inside the tags.`;
}

async function callClaude(prompt) {
  const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes
  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(`Anthropic call timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const textBlocks = data.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) {
    throw new Error(`Anthropic returned no text blocks. stop_reason=${data.stop_reason}`);
  }
  const fullText = textBlocks.map((b) => b.text).join("\n\n").trim();

  // TEMPORARY DEBUG: log full Claude output to diagnose extraction issues.
  console.log("[tennis-brief] DEBUG fullText start ===");
  console.log(fullText);
  console.log("[tennis-brief] DEBUG fullText end ===");

  // Extract content between <brief> and </brief> tags.
  // Fallback to full text if delimiters are missing — better to occasionally
  // leak thinking than to silently fail to send.
  const match = fullText.match(/<brief>([\s\S]*?)<\/brief>/);
  if (match) {
    return match[1].trim();
  }
  console.warn("[tennis-brief] WARNING: <brief> delimiters missing, returning full text");
  return fullText;
}

async function sendEmail(subject, body) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: RECIPIENTS,
      subject,
      text: body,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend API ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function runBrief() {
  const dates = getCentralDates();
  console.log(`[tennis-brief] run start: ${dates.long}`);

  const briefText = await callClaude(buildPrompt(dates.long));

  if (briefText === "SKIP") {
    console.log("[tennis-brief] SKIP — no email sent");
    return { status: "skipped", date: dates.short };
  }

  const subject = `Tennis Brief — ${dates.short}`;
  const result = await sendEmail(subject, briefText);
  console.log(`[tennis-brief] sent id=${result.id} subject="${subject}"`);
  return { status: "sent", subject, id: result.id, length: briefText.length };
}

runBrief().catch((err) => {
  console.error("[tennis-brief] failed:", err.stack || err.message);
  process.exit(1);
});
