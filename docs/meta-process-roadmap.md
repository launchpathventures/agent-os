# Meta Process Robustness Roadmap

**Created:** 2026-04-14
**Purpose:** Make every meta process as tight as the frontdoor. Each meta process must flow seamlessly end-to-end — no dead ends, no silent failures, no confused users.

**Benchmark:** The front door (Briefs 120-131) is the gold standard. Conversation → consent → chain fires → execution begins → SSE streams progress → email arrives → reply routes back. Every handoff is wired. Every edge case is closed. That's the bar.

---

## How to Read This

Each meta process is a section. Within each:
- **What exists** — code and briefs already built
- **What's broken or missing** — specific gaps found in the journey analysis
- **What "tight" looks like** — the target experience
- **Work items** — ordered tasks to close the gaps
- **Dependencies** — what must be done first

Priority: P0 = users hit this every session, P1 = users hit this weekly, P2 = users hit this monthly, P3 = compound effect / power users.

---

## MP-1: Goal Framing → Process Creation → First Run (P0)

**The meta process:** User says "I need X" → Self guides conversation → process proposed → user approves → process runs → first output appears for review.

**What exists:**
- `generate_process` tool (save=false preview, save=true commit)
- ProcessProposalBlock with interactive approval in UI
- `surface-actions.ts` handles proposal approval → calls `generate_process(save=true)`
- 22 templates in `processes/templates/`
- `matchTaskToProcess()` keyword routing (confidence >= 0.6)
- `executeOrchestrator()` goal decomposition with `goalHeartbeatLoop`

**What's broken:**
1. ~~**Process created → nothing runs.**~~ **Fixed (Brief 145, MP-1.2).** Both creation paths now lead to activation offer.
2. ~~**No template matching during conversational creation.**~~ **Fixed (Brief 145, MP-1.1).** `generate_process` now calls `findProcessModel()` first.
3. **Goal decomposition feedback gap.** `create_work_item` → `executeOrchestrator` fires via `setImmediate()`. Tool returns immediately with classification JSON. User sees no progress, no "breaking this down...", no ProgressBlock.
4. **Tier 3 auto-build is invisible.** When orchestrator generates a process via `triggerBuild()`, user never learns a new process was created for them.
5. ~~**`activate_cycle` doesn't execute.**~~ **Fixed (Brief 145, MP-1.3).** Now calls `fullHeartbeat()` via `setImmediate()` immediately after `startProcessRun()`.

**What "tight" looks like:**
- User approves proposal → Self asks "Ready to run this with your first request?" or auto-triggers if pending work matches
- Process generation checks template library first, proposes template with adaptations
- Goal decomposition streams progress: "Breaking this into 3 steps... Starting step 1..."
- Cycle activation calls `fullHeartbeat()` immediately (same as `start_pipeline`)
- Auto-built processes surface for user awareness: "I created a process for [sub-goal] — here's what it does"

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-1.1 | ~~Template matching in `generate_process`~~ — **done (Brief 145).** `findProcessModel()` called before building from scratch. >= 0.6 uses template structure, 0.3-0.6 mentions inspiration, < 0.3 from scratch. | enhancement | — |
| MP-1.2 | ~~Post-creation activation~~ — **done (Brief 145).** Both paths: form returns `conversationContext: { activationReady }`, conversational path has delegation guidance for `activationHint`. | enhancement | — |
| MP-1.3 | ~~`activate_cycle` fullHeartbeat fix~~ — **done (Brief 145).** `setImmediate(() => fullHeartbeat())` added, matching `start_pipeline` pattern. | bug fix | — |
| MP-1.4 | Goal decomposition progress — emit harness events during `executeOrchestrator` that the conversation can surface as ProgressBlocks | enhancement | — |
| MP-1.5 | Tier 3 build notification — when `triggerBuild()` creates a process, emit a ContentBlock notification to the user's next briefing or active conversation | enhancement | MP-1.4 |
| MP-1.6 | End-to-end test: "user says need → process proposed → approved → first run completes → output reviewed" | test | MP-1.1, MP-1.2 |

---

## MP-2: Onboarding → First Process → "Aha" Moment (P0)

**The meta process:** User clicks magic link from frontdoor email → lands in workspace → Alex greets them with context → guides to first process → first real output → user sees the value.

**What exists:**
- `processes/onboarding.yaml` (5 steps: gather-basics, identify-first-pain, reflect-understanding, propose-first-process, first-real-work)
- Magic link auth (Brief 123 — `magicLinks` table, `/chat` page, httpOnly cookie)
- `adapt_process` tool for runtime process adaptation
- KnowledgeSynthesisBlock and ProcessProposalBlock content blocks
- Progressive reveal: conversation-only until first process created
- Self speaks first for new users (`cognitive/self.md` onboarding guidelines)

**What's broken:**
1. **Frontdoor-to-workspace memory bridge.** Frontdoor builds user model and memories via the conversation. When user transitions to workspace via magic link, does `assembleSelfContext()` load those frontdoor memories? Self-scoped memories are workspace-scoped — frontdoor memories may be network-scoped. User may have to re-explain themselves.
2. **Magic link landing experience.** User clicks link, lands on `/chat`. Is Alex's greeting informed by the frontdoor conversation? Or is it a cold "Welcome to Ditto"?
3. **Onboarding → MP-1 handoff.** Onboarding step "propose-first-process" produces a ProcessProposalBlock. When user approves, does it connect to MP-1's creation flow? Or is it a separate path?
4. **Time-to-value.** Between "user approves first process" and "first output appears for review" — how long? What does the user see? Silence = churn.

**What "tight" looks like:**
- Magic link landing → Alex says "Hey [name], glad you're here. Based on our conversation, I know you're looking for [X]. Let's set that up."
- Frontdoor memories (user model, business context, ICP) carry over to workspace Self context
- First process proposal is template-matched (not blank), pre-filled with frontdoor context
- First output appears within minutes, with ProgressBlock showing real-time execution
- Progressive reveal triggers naturally — sidebar appears when first process is approved

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-2.1 | Audit memory bridge — trace whether frontdoor person-scoped and self-scoped memories are accessible to workspace `assembleSelfContext()`. Document the scoping gap if it exists | research | — |
| MP-2.2 | Frontdoor context injection — when magic link is consumed, load frontdoor conversation summary + user model into workspace session context | enhancement | MP-2.1 |
| MP-2.3 | Onboarding-to-creation handoff — verify that onboarding "propose-first-process" step connects to `generate_process` with template matching (MP-1.1) | integration | MP-1.1 |
| MP-2.4 | First-run streaming — ensure ProgressBlock appears during first process execution, SSE events flow through to `/chat` page | enhancement | MP-1.4 |
| MP-2.5 | End-to-end onboarding test: magic link click → greeting with context → first process approved → first output reviewed | test | MP-2.2, MP-2.3, MP-2.4 |

---

## MP-3: Daily Briefing → Orient → Review Cycle (P1)

**The meta process:** User opens Ditto → Self detects session gap → briefing assembles → review items surface inline → user approves/edits/rejects → next steps kick off → user monitors pipelines throughout day.

**What exists:**
- `get_briefing` tool with 5 dimensions (focus, attention, upcoming, risk, suggestions)
- `briefing-assembler.ts` queries active runs, pending reviews, recent completions
- Session gap detection triggers proactive briefing
- ReviewCardBlock with approve/edit/reject actions
- ProgressBlock populated from `activeRuns`
- SSE events for pipeline progress (`step-complete`, `gate-pause`, `run-complete`)
- `useHarnessEvents` + `use-pipeline-review.ts` hooks in web UI

**What's broken:**
1. **Autonomous digest missing.** When processes run at `autonomous` or `spot_checked` tier and auto-advance, there's no summary. User can't see "12 follow-up emails sent automatically, 2 got responses." Briefing only shows items that *need* attention, not a confidence-building summary of what happened autonomously.
2. **Briefing staleness.** If user opens Ditto at 2pm, is the briefing regenerated or stale from morning? `get_briefing` is an LLM call — does it cache? Does it know about intra-day changes?
3. **Review → resume latency.** User approves a review item. `approveRun()` calls `fullHeartbeat()` synchronously — this is good. But does the *next* gate-pause appear inline without page refresh? Does the SSE event fire and the UI react?
4. **Empty briefing.** When there's genuinely nothing to report, does the briefing gracefully say "all quiet" or does the LLM hallucinate importance?
5. **Stuck pipeline visibility.** Processes waiting for external events (email reply, API response) show as "in progress" but the user can't distinguish "actively running" from "waiting for Sarah to reply."

**What "tight" looks like:**
- Morning briefing includes autonomous summary: "While you were away: 8 emails sent (2 responses), 3 quotes generated (all approved automatically)"
- Briefing regenerates on each session gap, never stale
- Review approval → next step starts → SSE event → UI updates without refresh
- Empty state: "Nothing needs your attention. Your processes are running smoothly." (no hallucinated urgency)
- Waiting-for-event states show clearly: "Quoting process paused — waiting for supplier reply (sent 2 days ago)"

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-3.1 | Autonomous digest — extend `briefing-assembler.ts` to query auto-advanced step runs since last session, summarise by process | enhancement | — |
| MP-3.2 | Wait-state visibility — distinguish "running" from "waiting for external event" in ProgressBlock. Surface `wait_for` metadata with human-readable descriptions | enhancement | — |
| MP-3.3 | Briefing empty state — ensure `get_briefing` returns a calm "all clear" when no items need attention, no hallucinated urgency | enhancement | — |
| MP-3.4 | Review-to-resume UI flow — verify SSE event chain: approveRun → fullHeartbeat → gate-pause event → UI shows next review item without refresh | integration test | — |
| MP-3.5 | Briefing freshness — verify briefing regenerates per session gap, not cached stale. Add timestamp to briefing output | verification | — |

---

## MP-4: Feedback Capture → Pattern Detection → Learning Loop (P1)

**The meta process:** User edits an output → diff captured structurally → pattern detected after 3+ corrections → "Teach this?" surfaced → user accepts → next run is measurably better.

**What exists:**
- Feedback recorder (harness handler) captures diffs on edit
- Trust diff with WikiTrust severity model classifies edit significance
- Pattern notification after 3+ similar corrections (read-only)
- Process-scoped and self-scoped memories
- SLM training data pipeline (Brief 135 — extraction, readiness scoring, JSONL export)
- `improvement-scanner` system agent (architecture, not yet implemented)

**What's broken:**
1. **Loop not closed.** State.md says "Pattern notification — After 3+ corrections of same pattern, read-only notification surfaced. Precursor to Phase 8 'Teach this'." The notification exists but accepting it doesn't update anything. The user says "yes, learn this" and... nothing changes.
2. **No immediate effect.** First correction should have *some* effect on the next run. Currently corrections are stored as feedback records but not injected into the next execution's context. Memory-assembly loads process-scoped memories — but does the feedback-to-memory bridge actually write correction patterns as memories?
3. **Three-tier learning not wired.** Corrections should flow to: (a) process-scoped memory (immediate, next run), (b) quality criteria update (durable, affects all runs), (c) SLM training data (long-term, affects model). Only (c) appears implemented via Brief 135.
4. **No "before/after" evidence.** When the system claims it learned, the user should see evidence: "You used to correct invoice descriptions 60% of the time. After teaching, correction rate dropped to 5%."

**What "tight" looks like:**
- User edits output → diff captured → next run of same process includes correction as process-scoped memory ("User previously corrected X to Y")
- After 3+ corrections: "I notice you always change bathroom labour from 2h to 3h. Should I remember this?" → User says yes → quality criteria updated on process definition → memory written
- Correction rate tracked per pattern — evidence shown: "Labour estimate corrections: 60% → 8% after learning"
- SLM training data accumulates in background for eventual fine-tuning

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-4.1 | Feedback-to-memory bridge — when edit feedback is recorded, write a process-scoped memory with the correction pattern. Verify memory-assembly loads it for next run | enhancement | — |
| MP-4.2 | "Teach this?" action loop — when user accepts pattern notification, write durable process-scoped memory AND update process quality criteria | enhancement | MP-4.1 |
| MP-4.3 | Correction rate tracking — track per-process, per-pattern correction rates over time. Surface in process detail and briefing | enhancement | MP-4.2 |
| MP-4.4 | Evidence narrative — when suggesting trust upgrade or showing learning effect, include before/after correction rates | enhancement | MP-4.3 |
| MP-4.5 | End-to-end test: edit output 3x with same pattern → notification appears → accept → next run produces corrected output without human edit | test | MP-4.1, MP-4.2 |

---

## MP-5: Trust Earning → Tier Upgrade → Autonomy Expansion (P1)

**The meta process:** Process runs accumulate → approval rates tracked → system suggests upgrade → user sees evidence → accepts → fewer reviews required → eventually autonomous with digest.

**What exists:**
- Trust earning (sliding window 20 runs, conjunctive upgrades, disjunctive downgrades)
- `adjust_trust` tool (confirmed=false for proposal, confirmed=true after user approval)
- Trust control in UI (natural language slider)
- Evidence narrative
- `suggest_next` can recommend trust upgrades
- Degradation auto-downgrade

**What's broken:**
1. **Upgrade moment is buried.** Trust upgrade suggestion comes via `suggest_next` in briefing. But this is a *milestone* — the user's AI teammate just leveled up. It deserves more than a suggestion line.
2. **Downgrade communication.** Auto-downgrade happens silently in the trust computation. User discovers it when reviews start appearing again. No explanation of *why*.
3. **Autonomous digest not wired.** At autonomous tier, outputs auto-advance. But there's no mechanism to summarise what auto-advanced — ties to MP-3.1.
4. **Spot-check experience unclear.** At spot-checked, user reviews ~20% of outputs. The 80% they don't see — where are they? How does the user know those were fine?

**What "tight" looks like:**
- Trust upgrade surfaces as a celebratory moment: "Your quoting process has been 95% accurate over 25 runs. I'd like to check in less often — maybe 1 in 5 instead of every time. Here's the evidence: [narrative]. What do you think?"
- Downgrade is explained warmly: "I'm going to check in more on invoices — the last few had some issues I want to make sure we catch. [specific pattern]"
- Auto-advanced outputs appear in a collapsible "Handled automatically" section in the briefing
- Spot-checked outputs that weren't sampled appear in a "Reviewed by me, looked good" summary

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-5.1 | Trust upgrade celebration — dedicated ContentBlock for trust milestone with evidence narrative, distinct from regular suggestions | enhancement | — |
| MP-5.2 | Downgrade explanation — when `executeTierChange()` downgrades, generate human-readable explanation with specific patterns that triggered it. Surface in next briefing | enhancement | — |
| MP-5.3 | Auto-advanced summary — query auto-advanced step runs per process, generate collapsible summary for briefing | enhancement | MP-3.1 |
| MP-5.4 | Spot-check transparency — for spot-checked processes, show count of auto-advanced vs sampled runs in process detail | enhancement | — |

---

## MP-6: Inbound Email → Classification → Routing → Response (P0)

**The meta process:** Someone replies to Alex's email → inbound received → classified (positive/question/opt-out/OOO) → routed to correct process → response generated → quality gate → sent.

**What exists:**
- `inbound-email.ts` with reply handling
- `fireEvent("positive-reply")` triggers connecting-introduction process
- Cancellation signal detection (`isCancellationSignal()`)
- Email threading via `email_thread` metadata
- Opt-out management template
- Outbound quality gate (non-bypassable handler)

**What's broken:**
1. **Ambiguous reply routing.** "Maybe next month" — is that positive? Neutral? Currently classification is binary (positive-reply event or cancellation signal). Middle-ground replies may misroute.
2. **Reply speed.** Classification → routing → process execution → quality gate → send is a multi-step pipeline. For direct questions ("What's your pricing?"), latency matters.
3. **Thread context continuity.** Does the response maintain conversational context from the original outreach? Or does each reply start fresh?
4. **Opt-out reliability.** Must be immediate, permanent, and never fail. Is the opt-out path tested independently from the happy path?
5. **OOO handling.** Out-of-office replies should not trigger positive-reply events or count as engagement.

**What "tight" looks like:**
- Reply classification has 5 categories: positive, question, neutral/deferred, opt-out, auto-reply (OOO). Each routes differently
- Positive → connecting-introduction chain (existing)
- Question → Self handles conversationally with thread context
- Neutral/deferred → log interaction, adjust follow-up timing
- Opt-out → immediate removal, confirmation email, never contact again
- Auto-reply → ignore, don't count as engagement
- Direct questions get response within 5 minutes
- Thread context carries through — Alex references the original outreach naturally

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-6.1 | Reply classification expansion — add neutral/deferred and auto-reply categories to inbound email classification. Route ambiguous replies to Self for judgment | enhancement | — |
| MP-6.2 | Thread context injection — when processing a reply, load the original outreach content and prior thread as context for response generation | enhancement | — |
| MP-6.3 | OOO detection — identify auto-reply patterns (out of office, vacation, etc.) and exclude from engagement metrics and positive-reply events | enhancement | — |
| MP-6.4 | Opt-out reliability test — independent test suite for opt-out path: keyword detection, immediate removal, confirmation, permanent exclusion | test | — |
| MP-6.5 | Question fast-path — when reply is classified as a direct question, route to Self with thread context for conversational response (skip full process pipeline) | enhancement | MP-6.1, MP-6.2 |

---

## MP-7: Exception Handling → Escalation → Resolution (P1)

**The meta process:** Process step fails or produces low-confidence output → retry logic → still failing → escalate to user with context → user provides guidance → process resumes → guidance captured as memory.

**What exists:**
- Confidence gate (low confidence always pauses regardless of trust tier)
- Retry with feedback injection (`retry_on_failure`)
- Orchestrator escalation (Types 1/3/4)
- `detect_risks` tool (aging items, data staleness, correction patterns)
- Human step suspend/resume mechanism

**What's broken:**
1. **Escalation UX.** When a step fails after retries, the user sees a `waiting_review` state but the *reason* for failure may not be clear. Is the error message human-readable or a stack trace?
2. **Guidance capture.** User resolves an escalation by providing input. But is that input captured as a memory so the same escalation doesn't happen again? Or is it one-time?
3. **Stale escalations.** If the user doesn't respond to an escalation for days, does it age? Does `detect_risks` surface it? Is there a follow-up mechanism?
4. **Cross-process dependency failures.** If Process A depends on Process B's output, and B fails, does A know? Does the user see "Quoting blocked because supplier research failed"?

**What "tight" looks like:**
- Escalation message reads like a teammate asking for help: "I'm stuck on this quote — the client wants combined materials and labour pricing but I'm not sure how to structure that. How would you handle it?"
- User's guidance is captured as process-scoped memory → same situation auto-resolves next time
- Stale escalations surface in briefing after 24h: "This has been waiting for your input for 2 days"
- Cross-process failures show dependency context: "Quoting paused — waiting on supplier research (failed 1 hour ago, retrying)"

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-7.1 | Escalation message quality — when step fails or confidence is low, generate human-readable explanation with context, not raw error. Template per failure type | enhancement | — |
| MP-7.2 | Guidance-to-memory bridge — when user resolves an escalation, capture the guidance as process-scoped memory tagged with the failure pattern | enhancement | MP-4.1 |
| MP-7.3 | Stale escalation detection — extend `detect_risks` to surface escalations older than 24h. Include age and original context | enhancement | — |
| MP-7.4 | Cross-process dependency visibility — when a process is blocked on another process's output, surface the dependency chain in ProgressBlock and briefing | enhancement | — |

---

## MP-8: Cycle Management → Continuous Operation → Compound Effect (P2)

**The meta process:** User activates a cycle → Alex operates continuously → user sees aggregate results across days/weeks → cycle health tracked → multi-cycle coordination prevents conflicts.

**What exists:**
- 4 cycle types (sales-marketing, network-connecting, relationship-nurture, gtm-pipeline)
- Cycle tools (activate, pause, resume, status, briefing)
- Heartbeat auto-restart for continuous cycles
- Sub-process executor in heartbeat
- `cycle_briefing` standardised format
- `cycle_status` pipeline view

**What's broken:**
1. ~~**Activation doesn't execute**~~ **Fixed (Brief 145, MP-1.3).** `activate_cycle` now calls `fullHeartbeat()` via `setImmediate()`.
2. **Aggregate visibility.** `cycle_status` shows current run status but not aggregate metrics across cycle iterations. "47 outreach emails this month, 12 responses, 3 meetings" — this data exists in step runs but isn't aggregated for the briefing.
3. **Multi-cycle coordination.** Three cycles running = three processes potentially contacting the same people. No deduplication of contacts across cycles. Alex could email Sarah from connecting AND selling cycles.
4. **Cycle health signals.** When response rates drop across a cycle, no proactive insight. The cycle just keeps running the same way.

**What "tight" looks like:**
- Cycle activation → immediate execution (fix from MP-1.3)
- Cycle briefing shows aggregate KPIs: emails sent, response rate, meetings booked, trend arrows
- Contact deduplication across cycles: person contacted by one cycle is excluded from others for N days
- Cycle health alerts: "Response rates dropped 15% this week on your sales cycle — want to adjust the approach?"

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-8.1 | Fix activation execution | bug fix | MP-1.3 (same fix) |
| MP-8.2 | Cycle aggregate metrics — query step runs across cycle iterations, compute KPIs (volume, response rate, conversion). Surface in `cycle_briefing` | enhancement | — |
| MP-8.3 | Cross-cycle contact deduplication — before outreach, check if person was contacted by another cycle within N days. Skip or escalate if conflict | enhancement | — |
| MP-8.4 | Cycle health signals — detect declining metrics (response rate, conversion) across cycle iterations. Surface proactive suggestion to adjust approach | enhancement | MP-8.2 |

---

## MP-9: Process Definition → Editing → Evolution (P2)

**The meta process:** User wants to change a running process → conversational edit → process updated → existing runs unaffected → new runs use updated definition.

**What exists:**
- `adapt_process` tool (runtime overrides per run, not permanent)
- `generate_process` (creates new, doesn't edit existing)
- Process definitions stored as JSON in DB
- `definitionOverride` on processRuns for per-run adaptation

**What's broken:**
1. **No permanent edit path.** `adapt_process` is run-scoped (Brief 044, system processes only). There's no way to say "change this process permanently" through conversation.
2. **No version history.** Process definitions have a `version` field but no version history. If a permanent edit breaks things, no rollback.
3. **Editing while running.** If a process is mid-run, does an edit affect the current run? Architecture says no (new runs only), but is this enforced?

**What "tight" looks like:**
- User says "skip the follow-up step in my quoting process" → Self confirms scope (this run only or all future runs?) → applies change
- Permanent edits create a new version with the old version preserved
- Edit summary shown to user: "Updated quoting process v2 → v3: removed follow-up step"
- Running processes are unaffected; new runs use the updated definition

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-9.1 | Permanent process edit tool — extend `generate_process` or create `edit_process` tool that updates an existing process definition | enhancement | — |
| MP-9.2 | Version history — store previous definitions on edit, support rollback | enhancement | MP-9.1 |
| MP-9.3 | Edit scope confirmation — Self asks "just this run, or all future runs?" and routes to `adapt_process` (run-scoped) or `edit_process` (permanent) | enhancement | MP-9.1 |

---

## MP-10: Proactive Suggestions → Discovery → Expansion (P3)

**The meta process:** System observes user patterns → identifies gaps → suggests new processes → user accepts → system expands.

**What exists:**
- `suggest_next` tool with industry patterns + user model + process maturity
- Suggestion dismiss/accept loop with 30-day expiry
- Coverage-agent (12th system agent, architecture-defined)
- SuggestionBlock with action buttons in UI
- `detect_risks` for operational signals

**What's broken:**
1. **Suggestion quality.** Does `suggest_next` check existing processes before suggesting? "You should set up invoicing" when it already exists is worse than silence.
2. **Reactive-to-repetitive detection.** Architecture describes the lifecycle where ad-hoc work becomes a process. But `create_work_item` captures one-off tasks — where is the pattern detection that says "you've created 5 similar tasks, want a process?"
3. **Coverage-agent not implemented.** Listed as system agent but may not be operational.

**What "tight" looks like:**
- Suggestions never duplicate existing processes
- After 3+ similar work items, system proposes formalising: "You've created 3 quote requests this month. Want me to set up a quoting process?"
- Coverage-agent runs periodically, identifies gaps by comparing user's processes against industry patterns
- Suggestions are insightful and specific, not generic

**Work items:**

| # | Item | Type | Depends on |
|---|------|------|-----------|
| MP-10.1 | Dedup check in `suggest_next` — verify existing processes before suggesting. Filter out suggestions that match active process slugs | enhancement | — |
| MP-10.2 | Reactive-to-repetitive detector — scan work items for clustering patterns. After 3+ similar items, propose process formalisation | enhancement | — |
| MP-10.3 | Coverage-agent activation — implement the coverage-agent system agent for periodic gap analysis | enhancement | — |

---

## Execution Order

The meta processes have natural dependencies and priority ordering:

```
                    ┌─────────────────────┐
                    │ MP-1: Goal → Process │  ← P0, foundation for everything
                    │     → First Run      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼─────────┐
    │ MP-2: Onboarding│  │ MP-6: Email │  │ MP-7: Exception │
    │   → First "Aha" │  │   Routing   │  │   Handling      │
    └─────────┬──────┘  └────────────┘  └──────┬─────────┘
              │                                │
    ┌─────────▼──────────────────────────────────▼──────┐
    │ MP-3: Briefing → Orient → Review                  │
    │ MP-4: Feedback → Learning Loop                    │  ← P1, daily quality
    │ MP-5: Trust Earning → Autonomy                    │
    └─────────┬────────────────────────────────────────┘
              │
    ┌─────────▼──────────────────────────────┐
    │ MP-8: Cycle Management                 │
    │ MP-9: Process Editing / Evolution      │  ← P2, power users
    │ MP-10: Proactive Suggestions           │
    └────────────────────────────────────────┘
```

**Recommended build order:**
1. **MP-1.3** (activate_cycle fullHeartbeat — one-line fix, immediate impact)
2. **MP-1.1 + MP-1.2** (template matching + post-creation activation)
3. **MP-6.1 + MP-6.4** (email classification + opt-out reliability)
4. **MP-2.1 + MP-2.2** (memory bridge audit + context injection)
5. **MP-4.1** (feedback-to-memory bridge — enables MP-4.2, MP-7.2)
6. **MP-3.1** (autonomous digest — enables MP-5.3)
7. **MP-1.4 + MP-1.5** (goal decomposition progress)
8. **Remaining MP-3, MP-5, MP-7** (daily quality layer)
9. **MP-8, MP-9, MP-10** (power user features)

---

## Open Briefs Closing These Gaps

Briefs drafted 2026-04-16 to close the remaining meta-process gaps:

| Brief | Gap it closes | Priority |
|-------|---------------|----------|
| Brief 147 | MP-4.2 "Teach this?" learning loop closure | P1 |
| Brief 148 | MP-2.1 / MP-2.2 frontdoor → workspace memory bridge | P0 |
| Brief 155 | MP-1.4 orchestrator decomposition progress events | P0 |
| Brief 156 | MP-6 safety — email send outcome fidelity | P0 |
| Brief 157 | MP-3.2 stuck-state visibility in ProgressBlock | P1 |
| Brief 158 | MP-7.2 guidance-to-memory bridge for escalations | P1 |
| Brief 159 | MP-9.1 / MP-9.3 permanent process edit tool | P2 |
| Brief 160 | MP-3.1 / MP-5.3 autonomous "while you were away" digest | P1 |
