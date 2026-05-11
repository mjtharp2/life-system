# Ideation Log

Parking lot for prospective system extensions, agents, and architectural ideas surfaced in Blue Sky ideation conversations. Reviewed at quarterly checkpoints alongside the 90-day system review. Anything that graduates to "we're building this" moves to the architecture spec or Todoist. Anything that decays gets cut.

## Structure

Each entry includes: name, description, architectural fit, status, and any sequencing gates or open questions.

## Active Entries

### Finance — needs future-state scoping

Current reference doc treatment of finance is thin (Tier 2, "monthly cash flow visibility only"). The system should eventually surface financial state more deliberately — spending patterns, anomalies, runway, big-decision context, possibly investment tracking — but the right shape isn't clear yet. Not a current priority; needs a dedicated conversation.

**Trigger to revisit:** when system-design conversation has open agenda space and finance feels like a real gap, or at the 90-day review. Probably mid-to-late summer after Phase 1-3 ship.

**Out of scope for now:** anything beyond monthly visibility. No proactive build, no agent, no dashboard integration. Capture the lack of structure, revisit when ready.

**Status:** Parked.

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

### Newsletter aggregator and content synthesis system

Currently receiving ~10 daily newsletter emails from various sources. Read individually, this is a real time and attention tax; many days the relevant content is 10-20% of total volume but requires scanning all of it to find. Build an aggregator that reads daily newsletter emails via Gmail API, synthesizes through Claude with personal context, delivers prioritized digest, marks source emails read, and learns over time which sources earn their place via feedback loop.

**Tennis brief precedent:** GitHub Actions-based scheduled synthesis already proven out at $0.20/run, ~$6/month. Same infrastructure pattern — scheduled Action reads curated input, synthesizes through Claude with personal context, delivers personalized output. Newsletter version is a natural extension.

**Architectural insight:** The infrastructure (scheduled Action + curated input + Claude synthesis + delivery + feedback loop) is substrate for many applications beyond newsletters — weekly trainer analysis, therapy prep, Sunday review pre-aggregation, quarterly pattern review across dashboard data. Evaluate as "is this synthesis pattern worth investing in once" not as "is the digest worth it on its own."

**Core capabilities:**
- Read daily newsletter emails via Gmail API (filter by sender list)
- Aggregate, prioritize, and synthesize content into single digest
- Apply personal context from substrate (current tier focus, regulation state, week shape) to filter for relevance
- Mark source emails read after processing
- Feedback mechanism: rate each digest's usefulness, mark which items were actually acted on, system learns over time which sources earn their place vs. which should be cut
- Extensible to other content sources over time (RSS, Substack, podcasts via transcription, longer-form articles saved to read-later)

**Implementation paths:**
- Path A (Gmail API): subscribe to briefs in normal inbox, Action reads via Gmail API, synthesizes, sends, marks read. ~3-4 hours work including feedback capture surface. Same Gmail OAuth is on Phase 4 roadmap — building here gets that infrastructure as side effect, but design the OAuth implementation with Phase 4 reuse in mind, not as one-off.
- Path B (RSS): simpler, no auth, but most briefs lag on RSS vs. email and not all publish feeds. Probably wrong for morning use case.

**Critical open question, sharper than originally framed:** "Personal news digest" as smaller-version-of-ten-newsletters is solving a problem that already has solutions (read one or two, skip others). The version that genuinely reduces load is a *filter against current context* — surfaces the 3-5 things you'd actually act on or want to talk about given what you're working on this week. Build the filter version, not the digest version. The feedback loop is what makes the filter version actually viable — without learning which surfaces earn their place, the system stays generic.

**Other open questions:**
- What sources are actually in the 10? Honest audit needed — likely 2-3 are read, 4-5 are skimmed, 2-3 are subscribed-and-ignored. Some should be unsubscribed before any digest is built.
- Does this displace existing reading time or stack on top? Stack-on-top fails Design Principle 1.
- What does the feedback surface look like? One-tap rating per digest? Per-item? Both?
- Is the Gmail OAuth pull-forward worth it given Phase 4 timing?

**Sequencing gate:** Read tennis brief daily for 1-2 weeks first. If consistently useful, pattern is proven and digest version is worth real evaluation. If unread by week two, question answers itself. Don't commit to scope before that signal. Pre-work that doesn't require building anything: audit the 10 sources, unsubscribe from anything that's actually noise, narrow to the 5-7 that reliably contain signal.

**Status:** Parked, waiting on tennis brief usage data and source audit. Reconsider at end-of-July checkpoint or sooner if the synthesis pattern proves out for other applications first (trainer analysis, Sunday pre-aggregation).

### Pattern recognition over dashboard data

Once 90+ days of dashboard data exist (regulation level, sleep, readiness, habits, check-in notes), surface rule-based pattern detection — not ML, just hand-written rules over structured data. Examples: "last 3 Level 2 days were preceded by Oura readiness <70 for 2+ days," "compensatory behavior events cluster on Wednesdays," "missed self-time block predicts dysregulation within 48h." System learns specific failure modes by reading data you'd otherwise forget.

**Architectural fit:** Strong. Substrate already produces this data daily. Implementation is ~50 lines of code over D1 queries.

**Why deferred:** Genuine ML-driven prediction requires data volume not realistic at one-user scale. Rule-based version mislabeled as "predictive model" is what's actually wanted — useful, ships easily, but only after enough data exists to write rules from real patterns vs. theory.

**Status:** Parked. Reconsider at end-of-July checkpoint when 90-day dataset exists. Cut from current build plan deliberately — rule-based detection without enough data to ground the rules is theater.

### Compensatory behavior capture

The depletion loop has a destructive side (vape pulls, doom scroll sessions, restaurant choices when depleted, the moment the itch hits) that the current system doesn't see. Ulysses contracts are binary (held/broken). Missing: the *texture* — what was happening 2 hours before the craving, regulation state when it hit, what followed.

**Shape:** Frictionless one-tap capture — "I just had the urge" / "I just acted on it" — with auto-pulled context (time, regulation level from last check-in, calendar density of prior 4h, sleep last night). Builds dataset to actually understand the loop instead of just defending against it.

**Architectural fit:** Strong. Single Todoist quick-action or dashboard button writes to D1 with auto-context. Low capture friction is critical — anything more than one tap won't get used in the moments that matter.

**Why valuable:** The protective side of the loop (sleep, workouts, habits) is well-tracked. The destructive side is invisible. Six months of this data would be more diagnostic than any habit checkbox.

**Status:** Parked. High potential value but real privacy/dignity considerations in capturing this kind of data. Worth thinking through before building — what happens to the data, who sees it, what triggers a review. Reconsider after Phase 4 ships when the substrate can hold it cleanly.

### Decision logging for consequential choices

Soft enforcement of the existing Ulysses contract ("no decisions while at Level 3"). Any decision tagged consequential (relationship, work, substance, financial commitment) gets timestamped + regulation state captured + 24h hold before execution. Not restriction — record. Six months later, see which decisions were made dysregulated and how they turned out.

**Architectural fit:** Light. Todoist project + dashboard surface + D1 row. No real engineering.

**Why valuable:** Pairs with the regulation thesis directly. Currently the contract is a stated rule; this makes it a *practiced* rule with audit history.

**Status:** Parked. Could be built quickly post-Phase 4 as a small adjacent surface. Reconsider when the existing scheduler ritual is actually load-bearing — adding decision logging before that risks stacking surfaces on a system that isn't yet trusted.

### Bad-week mode (MVS toggle)

Minimum Viable System exists in reference doc but not in dashboard. A literal toggle — "I'm at Level 2, switch the system to MVS" — that hides everything except sleep floor, stimulant contract, Addie anchor, and a single grounding next action. Auto-defers all proposed tasks for that week. Scheduler stops proposing. System bends toward you on bad days instead of staring back with a full task list.

**Architectural fit:** Strong. Single state flag in D1 read by all dashboard surfaces and the scheduler.

**Why valuable:** Direct embodiment of Design Principle 4 (build for bad weeks, not good ones). Currently the system has the same shape regardless of regulation state — works fine at Level 0, can be load-amplifying at Level 2.

**Status:** Parked. Strong candidate for early post-Phase 4 work. Reconsider at end-of-July checkpoint — should arguably ship before any agent extensions because it's a regulation feature, not an optimization feature.

### Saturday morning intention prompt

Sunday weekly review is in the architecture, but Saturday is the actual hinge of the week (tennis, Addie, Emma evening). A Saturday morning prompt — "what would make this weekend feel like a real weekend" — captured before the day starts is different from a Sunday postmortem. Pre-week intention vs. post-week review.

**Architectural fit:** Trivial. One scheduled prompt, one D1 row.

**Why valuable:** Catches weekend drift before it happens. Sunday review can then check intention vs. reality, not just track what occurred.

**Status:** Parked. Tiny build. Reconsider after Phase 3 scheduler ships and weekly rhythm is established.

### Therapy as a tracked surface

Unusually structured therapy pipeline (individual + two couples tracks + future polycule work) currently has no home in the dashboard. Per-track view: date of last session, what came up, what to bring next time. Especially useful across two couples therapists where you're the connective tissue.

**Architectural fit:** Light. Notes structure with metadata. Could live in repo as markdown or in D1.

**Why valuable:** Therapy prep currently happens (or doesn't) in scattered notes apps. A structured surface makes the prep ritual itself easier and prevents the "what were we going to bring up" problem.

**Status:** Parked. Low engineering cost but real privacy considerations — this data is sensitive enough that storage and access need explicit thought. Reconsider after Phase 4 with privacy model defined first.

### Relationship state tracking (light version)

Per-relationship two-tap weekly rating: connection quality, friction present. Lauren, Emma, Addie. Not gamification of intimacy — depletion loop shows up *first* in relationship texture, before sleep scores. Catches drift earlier than quarterly review.

**Architectural fit:** Light. Three buttons, three D1 rows per week.

**Critical caveat:** Heavier "relationship intelligence agent" version (logging conversation moments, current preoccupations, emotional states) is high-value but also high-capture-burden and has surveillance-of-loved-ones risk. Light version (weekly rating only) is the realistic build. Anything more should be a journaling habit with structure, not an agent.

**Status:** Parked. Light version is buildable post-Phase 4. Heavy version probably shouldn't be built — the right answer is structured journaling, not instrumentation.

### Long-arc questions surface

Most personal systems track tasks; almost none track the open questions you're actually living inside. Emma/Lauren structural question. Body composition push. Tenex 100-day calls. Not action items — *questions*. Reviewed quarterly. What actually moves a life isn't the next task, it's how you're metabolizing the standing questions.

**Architectural fit:** Light. Markdown file in repo, reviewed at 90-day cadence alongside reference doc.

**Why valuable:** Quarterly review currently focuses on goals and tier reassignment. Adding a "questions" pass surfaces the structural inquiries that don't fit task language but drive most real change.

**Status:** Parked. Could be built immediately as a markdown file (`questions.md`) in repo without any engineering. Reconsider whether to formalize at next quarterly review.

### Energy-aware daily intensity proposal

Oura readiness paired with calendar density to propose daily intensity: "today is a 62 readiness day with 6 hours of meetings — defer the T1 focus block, do the admin block instead." Proposal-not-automation principle applied to daily shape, not just weekly scheduling.

**Architectural fit:** Strong. Once Phase 3 scheduler exists, this is a Phase 4+ extension that reads the same substrate and proposes daily adjustments.

**Why valuable:** Currently the scheduler operates at weekly granularity. Daily readiness variance is real and the system could honor it without the user manually re-planning.

**Status:** Parked. Natural Phase 4+ extension once weekly scheduler is trusted. Don't build until weekly proposal flow is load-bearing — adding daily proposals on top of an unused weekly proposal is just more noise.

### Money as ambient, not absent

Tier 3 currently means monthly check-in only. "Ambient" is different from "absent" — a single number on the dashboard (monthly burn vs. expected, or runway in months) with no drill-down would honor the Tier 3 placement while preventing the surprise that creates a future overload spike.

**Architectural fit:** Light if a financial data source exists (Plaid, manual entry, bank export). Real engineering if not.

**Why valuable:** Financial surprises are a known dysregulation trigger. A single ambient number prevents the "wait, what?" moment without inviting the daily-check rabbit hole.

**Status:** Parked. Worth honest evaluation: is Tier 3 the right placement, or is finances actually undertracked relative to its capacity to disrupt? Reconsider at end-of-July checkpoint.

### Creative container surface

The "one low-stakes private creative container" is in the reference doc but has no home. Currently the 11-11:30 self time produces fragments that live (or die) in Notes apps. A space inside the dashboard or repo for the seed — not productized, not deadlined, just a place where the words go.

**Architectural fit:** Trivial. Markdown file in repo, or a D1 table with timestamps.

**Why valuable:** The creative container is named in the strategic doc but has no infrastructure. Without a home, the thing decays.

**Status:** Parked. Could ship immediately as `creative.md` in repo. Reconsider whether to build a richer surface only if the markdown version gets used consistently.

### Phone autopsy (weekly)

Total screen time, top apps, paired with regulation level — to make avoidant phone use visible. Current system tracks protective behaviors (sleep, workouts) but not the avoidant ones (doom scroll, social media drift). Phone is the largest single data source on compensatory behavior and currently invisible to the system.

**Architectural fit:** Medium. Apple Screen Time API access is limited; realistic implementation is weekly manual screenshot/export or third-party tool.

**Why valuable:** Pairs with compensatory behavior capture (Entry 4). The phone is where most of the destructive side of the loop actually plays out, and it's currently a black box.

**Status:** Parked. Real privacy considerations and real implementation friction. Reconsider only if compensatory behavior capture (Entry 4) ships and proves out the value of tracking the destructive side of the loop.

### Agent suite — retrieval agents (gift, home, correspondence)

Three lightweight agents that share architecture: structured data + capture form + query interface. Not "AI agents" in any deep sense — closer to Todoist projects with better UX, queryable through Claude when context-aware answers are needed.

- **Gift agent:** birthday/anniversary tracker, gift history per person, ideas captured throughout year, budget per relationship tier. Non-trivial cognitive load currently held in head across Lauren, Emma, Addie, twins, parents, in-laws, close friends.
- **Home maintenance agent:** HVAC service dates, WiFi password, car oil change cadence, warranty tracking. Boring but expensive when it fails.
- **Correspondence agent:** who haven't I talked to in too long, drafts of replies, important threads left dangling. The "one real call per month with Matt R" lives here.

**Architectural fit:** Strong. Each is a D1 table + capture flow + dashboard surface. Each ships in a weekend.

**Why valuable:** All three currently live as low-grade background load — items not forgotten enough to be off the list, not surfaced enough to be acted on. Substrate-aware versions can surface contextually.

**Status:** Parked. Strong candidates for post-Phase 4 wave one. Build sequence likely gift → home → correspondence based on relative cognitive load each currently imposes.

### Agent suite — taste engines (restaurant, reading, film/TV)

Rating + context + recall systems. Most apps do one of three; combined version is qualitatively different. Substrate-aware: knows you're at Level 2 and recommends comfort vs. novelty; knows date with Lauren vs. solo lunch vs. Emma visit.

- **Restaurant taste:** rating + occasion tags + recall query. Most useful surface is "what should we do for date night."
- **Reading taste:** what finished vs. abandoned, what re-read, what quoted. Pairs with 11-11:30 self time. Goodreads/Kindle export simplifies capture.
- **Film/TV taste:** shared Lauren/Emma surface — "you both rated X highly, haven't watched together in 3 weeks."

**Architectural fit:** Strong. D1 tables, capture forms, query interface through Claude.

**Critical caveat:** Manual rating + manual context tagging is the realistic shape. "Taste engine that learns your preferences" without explicit rating isn't viable at one-user data scale. The system "learns" by you teaching it explicitly.

**Status:** Parked. Restaurant version is highest-value first build (most decision frequency, most context-dependent). Reconsider after Phase 4 with ChatGPT extraction integrated — extracted threads likely contain real rating data already.

### Agent suite — health timeline aggregator

Pulls Oura + Ro + lab portals + appointment notes + supplement tracking + medication history into one unified health timeline. Currently scattered across multiple apps and physical paperwork.

**Architectural fit:** Medium. Each source has different access pattern — Oura API exists, Ro likely email-export-only, labs are PDFs, appointments are calendar data. Real integration project.

**Why valuable:** Health context currently lives in 6+ places. A unified timeline makes "what changed when" answerable, makes appointment prep easier, and creates the substrate for any future medical decision that benefits from longitudinal data.

**Status:** Parked. Real engineering. Reconsider post-Phase 4 with explicit scope decision — "full timeline" is large; "Oura + manual annotations" is a weekend.

### Agent suite — professional intelligence (Tenex political map)

Internal political/relationship map for Tenex (and Sentinel/Netcov as relevant). Who reports to whom, who said what about whom, what's Mike's current preoccupation, what's Varun working through. Notes from 1:1s, observations about dynamics, things to bring up next conversation.

**Architectural fit:** Light. Markdown notes structure with metadata, queryable through Claude.

**Critical distinction:** This is *not* an industry news filter (which is just RSS with extra steps and not worth building). The valuable piece is the *internal* political map — currently held in head, lossy, easy to forget who said what when.

**Status:** Parked. Privacy considerations significant — this data should not be in the repo if the repo is public. Either private repo or alternative storage. Reconsider when storage model is settled.

### Architectural pattern — agents share substrate

Cross-cutting principle, not a feature. The compounding win of building agents on shared substrate (D1, repo docs, regulation state, calendar) is qualitatively different from running ten unrelated apps. Same-substrate examples:

- Taste engine knows Level 2 → recommends comfort, not novelty
- Gift agent knows depletion week → proposes easy option, not ambitious one
- Travel agent sees Emma traveling → plans differently than solo
- Style agent knows 205→185 cut → suggests differently than goal weight
- Decision agent refuses to surface consequential question on Level 3 day

**Implementation reality:** Cross-agent rules are hand-written, not inferred. There are maybe 10-20 such rules that would actually fire usefully. Write them as explicit rules in scheduler/proposal logic. Don't try to build a general inference engine — that outstrips current single-user-scale tech.

**Status:** Standing principle. Apply to every agent that gets built. Document explicit cross-agent rules in architecture spec as they're written.

### ChatGPT corpus extraction and integration

Years of accumulated personal context across thousands of ChatGPT conversations — relationship thinking with Lauren and Emma, training history, health/substance/regulation patterns, professional decisions, strategic thinking. Currently sitting as a downloaded export, unintegrated.

**Two artifacts, not one.** Reference docs (synthesized current-state thinking by domain, ~10-30 pages each, edited and authoritative) versus searchable archive (full corpus indexed and queryable via vector DB + MCP tool). They solve different problems and want different shapes — reference docs answer "what's my current state on X," archive answers "what did I actually say about X two years ago."

**Architectural fit:** Strong. Reference docs are markdown files in repo (public or private depending on sensitivity). Archive uses Cloudflare Vectorize (already in stack ecosystem), embedding API, worker route for query, exposed as MCP tool to Claude conversations.

**Sequencing logic:** Reference docs first (synthesis project, several Cowork sessions). Archive second (infrastructure project, requires Phase 4 substrate). Reference docs likely capture 80% of the value — archive becomes useful when reference docs aren't enough.

**Privacy considerations:** Relationship reference doc in particular will contain content unsuitable for public repo. Three options: private GitHub repo (parity with stack), local-only (lose history), Claude.ai project file (never enters git). Decide before producing content.

**Trigger to revisit:** Either a felt, repeated moment of "I wish I could find what I said about X" — that's the signal the archive is worth investing in — or Phase 4 completion creating clean integration substrate. Until then, the export is saved and not lost.

**Why not a current priority:** Doesn't unblock any active build. Relationship thread is making progress with current-state thinking. Trainer is functioning fine without comprehensive history. Building speculatively before knowing what queries matter risks over-extracting and producing reference docs nobody fetches.

**Related entries:** Restaurant/reading/film taste engines may benefit from extraction (extracted threads likely contain real rating data). Tenex political map should not be in public repo regardless of corpus storage decision.

**Status:** Parked, mapped to Phase 6 in architecture spec. Reconsider when triggers above fire, or at end-of-July checkpoint.

### Deferred until tech matures (post-2026)

Catalog of ideas that came up but realistically need waiting on:

- **Unified conversational agent surface** ("morning Claude" with all agent contexts loaded). Possible today via custom orchestration but the failure mode is hallucinated state. MCP standardization will make this commodity in 18 months.
- **Genuine ML-driven prediction** of regulation state. Single-user data volume insufficient. Rule-based version (Entry 3) is the realistic substitute indefinitely.
- **Cross-agent inference engine.** Hand-written rules cover the realistic use cases; general inference outstrips one-user-scale viability.
- **Ambient voice capture.** Reliability not at consumer-grade for personal data writes. 2-3 years out.
- **Automated taste learning without explicit rating.** Multi-billion-dollar problem at population scale; not viable at single-user scale.

**Status:** Standing reference. Reconsider individual items at quarterly checkpoints if tech landscape shifts. Most likely first to mature: ambient voice (gated by Realtime API + consumer hardware, late 2026/early 2027 window).
