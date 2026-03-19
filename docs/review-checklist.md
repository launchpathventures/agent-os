# Architecture Review Checklist

Use this checklist to review every piece of work against the Agent OS architecture. This is the harness on our own build process.

## How to Use

After producing work for any phase or task, spawn a separate review agent with this checklist and `docs/architecture.md` as context. The review agent produces a PASS/FLAG/FAIL report. Present both the work and the review to the human for decision.

## Checklist

### 1. Layer Alignment
Does this change map to a specific layer in the architecture? Which one(s)?
- Layer 1: Process — definitions, inputs, outputs, quality criteria
- Layer 2: Agent — adapters, roles, heartbeat, budget
- Layer 3: Harness — review patterns, trust tiers, escalation
- Layer 4: Awareness — dependency graph, event propagation
- Layer 5: Learning — feedback, correction patterns, improvements
- Layer 6: Human — CLI/UI, review queues, dashboards
- Cross-cutting: Governance, agent authentication

### 2. Provenance
Is there a source project for this pattern? Is the ADR written?
- Every adopted pattern must cite: project name, file path, what we took
- Every original pattern must be explicitly marked as "original to Agent OS"
- If no provenance exists, FLAG it

### 3. Composition Check
Are we building something that already exists in a proven project?
- Check `docs/landscape.md` for evaluated alternatives
- If a proven solution exists and we're building custom, justify why
- The default is to adopt, not invent

### 4. Spec Compliance
Does this match what `docs/architecture.md` says?
- If it deviates, is the spec wrong or is the code wrong?
- If the spec needs updating, flag it — don't silently diverge

### 5. Trust Model
Does this respect trust tiers?
- Does it default to supervised?
- Does it never auto-approve without explicit trust tier configuration?
- Does it never auto-upgrade trust?

### 6. Feedback Capture
Does this change capture data that the learning layer will need?
- Every human decision (approve/edit/reject) must be recorded
- Every harness decision (advance/pause) must be recorded
- Diffs must be captured for edits

### 7. Simplicity
Is this the minimum needed for the current task?
- No features for hypothetical future requirements
- No abstractions for one-time operations
- Three similar lines is better than a premature abstraction

### 8. Roadmap Freshness
Is the roadmap up to date?
- Does `docs/roadmap.md` reflect what we learned?
- Are deferred items still correctly deferred?
- Have re-entry conditions changed?
- Does `docs/state.md` reflect current reality?
