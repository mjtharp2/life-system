// Daily tennis brief: Claude (with web search) → Resend → email.
// Runs on GitHub Actions. Cron is configured in the workflow YAML, not here.

const RECIPIENTS = ["mjtharp2@gmail.com", "lauren.j.tharp@gmail.com"];
const FROM = "onboarding@resend.dev";
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
  return `You are writing a daily tennis brief for Matt and Lauren, a couple in Chicago who are tennis fans. They want to follow ATP and WTA singles tennis at the major and 500+ level, plus any tennis happenings in or around Chicago.

Use web search to find:
1. ATP and WTA singles results from yesterday at Grand Slams, Masters 1000, WTA 1000, ATP 500, and WTA 500 events.
2. ATP and WTA singles matches scheduled for today at the same levels. For key matches, include the start time in Central time and the TV network or streaming service if readily available.
3. Any tennis-related news, events, or happenings in Chicago.

Output rules:
- If there is genuinely nothing happening — no tour-level matches yesterday or today, no Chicago tennis news — respond with the single word SKIP and nothing else.
- Otherwise, write the brief in plain text (no markdown headers, no bullets unless natural). Open with "Matt and Lauren," and a sentence framing the day. Then a short paragraph on yesterday's notable results. Then a short paragraph on today's matches worth watching, with the headline storyline first. For headline matches, include start time (Central) and TV/streaming network when you can find them — formatted naturally, e.g. "Sinner-Alcaraz, 2pm CT on Tennis Channel." If you can't find a time or network for a match, don't speculate — just leave it out for that match. Then, if relevant, a brief note on Chicago. Keep the whole thing under 300 words.
- Be opinionated. Don't list everything — pick what matters. If Sinner-Alcaraz is playing, that's the headline. If it's a quiet day at a 500, say so briefly and move on.
- No "Good morning" preamble beyond "Matt and Lauren,". No closing signoff. The brief ends when the content ends.
- Today's date is ${todayLong}.`;
}

async function callClaude(prompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const textBlocks = data.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) {
    throw new Error(`Anthropic returned no text blocks. stop_reason=${data.stop_reason}`);
  }
  return textBlocks[textBlocks.length - 1].text.trim();
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
