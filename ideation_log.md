# Ideation Log

Parking lot for prospective system extensions, agents, and architectural ideas surfaced in Blue Sky ideation conversations. Reviewed at quarterly checkpoints alongside the 90-day system review. Anything that graduates to "we're building this" moves to the architecture spec or Todoist. Anything that decays gets cut.

## Structure

Each entry includes: name, description, architectural fit, status, and any sequencing gates or open questions.

## Active Entries

### Voice interface as unified system channel

Add a voice layer to the substrate so the full system (dashboard, agents, scheduler, taste/health/trainer data) is reachable via audio through phone or desk speaker, with all input channels flowing back through one consistent system state.

**Architectural fit:** Strong. The substrate being built (D1, worker routes, shared agent state, repo-based docs) is exactly the right shape for a voice client. Voice becomes another window onto the same system, not a separate ecosystem. Single-channel consistency across dashboard, mobile, voice is a real compounding win of having built the substrate.

**Realistic build hierarchy:**
- Tier 1 (after Phase 4): Phone-based voice via iPhone Shortcuts → worker endpoint → Claude with context → spoken response. ~1 weekend. 80% of the value.
- Tier 2 (fall/winter): Desk speaker with push-to-talk. Small device, simple capture loop, bypasses wake-word problem. Real project but doable.
- Tier 3 (defer to 2027): True ambient voice — wake word, far-field mic, sub-second latency. Tech curve hasn't caught up; building now produces disappointing result.

**Hard parts to know about:** Wake word detection at consumer quality is expensive to replicate. Far-field audio needs real mic hardware, not laptop USB. Latency on cloud round-trip is 3-7s currently, breaks conversational feel. Privacy implications of always-on listening device are real and worth thinking through with Lauren and Emma before committing to that form factor.

**What's changing:** OpenAI Realtime API and Anthropic equivalents collapse transcribe→think→speak into streaming calls with sub-second latency. Consumer hardware to run these well at home is 12-18 months out. Right window to build the ambient version is late 2026 / early 2027.

**Gates before building:** (1) Phase 4 shipped — substrate must be durable enough to support another client. (2) ChatGPT extraction done — voice responses need real personal context (tiers, loop, taste, trainer state) or it's just a worse Siri.

**Status:** Parked. Reconsider at end-of-July checkpoint or after extraction completes, whichever is later.

### Synthesis-from-curated-sources daily digest

Tennis brief shipped via GitHub Actions ($0.20/run, ~$6/month) proved out a reusable pattern: scheduled Action reads curated input, synthesizes through Claude with personal context, delivers personalized output. Morning news digest is one application; pattern extends to weekly trainer analysis, therapy prep, Sunday review pre-aggregation, quarterly pattern review across dashboard data.

**Architectural insight:** The infrastructure (scheduled Action + curated input + Claude synthesis + delivery) is substrate for many applications. Evaluate as "is this synthesis pattern worth investing in once" not as "is the digest worth it on its own."

**Implementation paths:**
- Path A (Gmail API): subscribe to briefs in normal inbox, Action reads via Gmail API, synthesizes, sends. ~2-3 hours work. Same Gmail OAuth is on Phase 4 roadmap — building here gets that infrastructure as side effect, but design the OAuth implementation with Phase 4 reuse in mind, not as one-off.
- Path B (RSS): simpler, no auth, but most briefs lag on RSS vs. email. Probably wrong for morning use case.

**Critical open question, sharper than originally framed:** "Personal news digest" as smaller-version-of-five-newsletters is solving a problem that already has solutions (read one, skip others). The version that genuinely reduces load is a *filter against current context* — surfaces the 3 things you'd actually act on or want to talk about given what you're working on this week. Build the filter version, not the digest version. If filter version isn't viable, probably shouldn't build at all.

**Other open questions:**
- What sources would actually be read vs. subscribed-and-ignored? Honest audit needed.
- Does this displace existing reading time or stack on top? Stack-on-top fails Design Principle 1.
- Is the Gmail OAuth pull-forward worth it given Phase 4 timing?

**Sequencing gate:** Read tennis brief daily for 1-2 weeks first. If consistently useful, pattern is proven and digest version is worth real evaluation. If unread by week two, question answers itself. Don't commit to scope before that signal.

**Status:** Parked, waiting on tennis brief usage data. Reconsider at end-of-July checkpoint or sooner if the synthesis pattern proves out for other applications first (trainer analysis, Sunday pre-aggregation).
