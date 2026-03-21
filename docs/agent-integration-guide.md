# Ditto — Integration Guide for AI Agents

**Purpose:** This document is designed for AI coding agents (Claude Code, Cursor, Copilot, OpenClaw, custom agents) to read and integrate Ditto concepts into their projects. It is structured for machine parsing: clear definitions, actionable patterns, copy-adaptable code structures.

**How to use this document:** Read it when building or improving AI agent systems. Each section is a self-contained concept with a problem statement, the Ditto pattern, and how to implement it.

---

## Core Principle

**Processes declare structure. Agents bring judgment. The harness evaluates outcomes.**

A process governs what happens and in what order. The agent within each step has freedom to decide how. The harness evaluates whether the output meets quality criteria. This ensures consistency without rigidity.

**Why this matters:** AI without durable process reinvents its approach every time. The same prompt produces different outcomes — not because context shifted, but because nothing governs how the work gets done. Processes are the antidote: defined once, refined through corrections, executed consistently.

---

## Pattern 1: Progressive Trust

**Problem:** Binary trust — either supervise everything or trust blindly.

**Pattern:** Four trust tiers earned through track record, never auto-upgraded.

```
TRUST TIERS (per process, not global):
  supervised    → human reviews every output
  spot-checked  → human reviews ~20% (deterministic sampling)
  autonomous    → exception-only review
  critical      → always full review, never upgrades

EARNING (sliding window, last 20 runs):
  Upgrade requires ALL: approval_rate > threshold AND correction_rate < threshold AND consistency
  Downgrade requires ANY 2 OF 4: correction_spike OR rejection_spike OR downstream_issues OR input_change

RULES:
  - System SUGGESTS upgrades. Human DECIDES.
  - System AUTO-downgrades. No human needed.
  - Per-output confidence OVERRIDES tier: low confidence → always pause.
```

**Integration:** Add a trust tier to each process/workflow. Track approval and correction rates over a sliding window. Suggest upgrades when thresholds are met. Auto-downgrade on quality drops.

---

## Pattern 2: Implicit Feedback

**Problem:** Humans won't fill out feedback forms. Explicit feedback loops fail.

**Pattern:** Every human action IS feedback. Capture structurally from natural workflow.

```
FEEDBACK SIGNALS:
  edit    → diff captured (word-level), correction pattern extracted
  approve → reinforces current approach, contributes to trust earning
  reject  → negative signal with optional reason, triggers trust evaluation

PATTERN DETECTION:
  After 3+ corrections of same type → surface notification:
    "You consistently [correction pattern]. Make this permanent?"
  Human confirms → quality criterion added to process definition
  Human dismisses → pattern noted, not enforced

MEMORY:
  Two scopes, merged at invocation:
    agent-scoped  → cross-cutting knowledge (style, preferences, learned patterns)
    process-scoped → specific to this process (correction history, quality criteria)
```

**Integration:** Diff every human edit. Store corrections with context. After N similar corrections, propose making the pattern permanent. Maintain two memory scopes: what the agent knows generally, and what it knows about this specific workflow.

---

## Pattern 3: Agents Check Agents

**Problem:** Raw AI output goes directly to humans. Quality is inconsistent.

**Pattern:** Composable review patterns run before human sees output.

```
REVIEW PATTERNS (compose for high-stakes):
  maker-checker    → Agent A produces, Agent B reviews against spec
  adversarial      → Agent B specifically tries to find flaws
  spec-testing     → Output tested against declared quality criteria
  ensemble         → Multiple agents produce independently, compare for divergence

ON FAILURE:
  Retry with reviewer feedback injected into producer context.
  After max retries: set confidence = low → trust gate pauses for human.
```

**Integration:** Before returning output to the user, run at least one review pattern. Inject review feedback on retry. Track which review patterns catch real issues vs false positives.

---

## Pattern 4: Cognitive Architecture

**Problem:** Agents execute tasks mechanically. Same skills, variable quality depending on how the problem is framed.

**Pattern:** Three-layer cognitive architecture — infrastructure + toolkit + context.

```
LAYER A — COGNITIVE INFRASTRUCTURE (always active):
  context_assembly    → Position-aware working memory. Critical info at start + end.
  metacognitive_check → Between steps: "Is this approach converging on the goal?"
  friction_detection  → Track retries, confidence trajectory, correction accumulation.
  inhibitory_control  → Recognize unproductive patterns. Stop. Surface what was learned.
  calibrated_uncertainty → Express honest confidence. "I'm not sure" is valuable.

LAYER B — COGNITIVE TOOLKIT (available, not mandated):
  mental_models:
    - first_principles: "What are the fundamental truths here?"
    - inversion: "What would make this fail?"
    - second_order: "What are the consequences of the consequences?"
    - circle_of_competence: "Am I qualified to judge this?"
    - hypothesis_driven: "What's my hypothesis? How would I disprove it?"

  reflection_prompts:
    - "Am I solving the right problem?"
    - "What would I do differently if I started over?"
    - "What surprises me about the current state?"

  Delivery: Inject as context. Agent CHOOSES whether to use. Never prescribe.

LAYER C — COGNITIVE CONTEXT (per-step framing):
  framing: exploratory | analytical | convergent | adversarial | generative | integrative
  toolkit: [which mental models are available]
  reflection: goal-check | approach-check | assumption-check
  freedom: high | medium | low  # scaffolding depth — capable models need less

  Example:
    research step → framing: exploratory, toolkit: [hypothesis-driven, first-principles], freedom: high
    review step  → framing: adversarial, toolkit: [inversion], freedom: medium
    decision step → framing: convergent, toolkit: [second-order, circle-of-competence], freedom: low
```

**Key insight:** Too prescriptive = fancy workflow. Too unstructured = raw chat. The sweet spot = structured toolkit + executive judgment + space for intuition. Provide tools. Let the agent choose. Track what works. Recommend — never prescribe.

**Integration:** Before each step, inject cognitive context into the agent's prompt. Set the framing (what mindset?), declare available mental models (what tools?), and specify scaffolding depth (how much structure?). Track which cognitive approaches correlate with best outcomes. Adjust over time.

---

## Pattern 5: Executive Function (Orchestrator)

**Problem:** Orchestrators decompose goals into tasks and track completion. They're task trackers, not managers.

**Pattern:** The orchestrator monitors intention, detects friction, and adapts.

```
ORCHESTRATOR REFLECTION CYCLE (at each heartbeat):
  1. ASSESS: Are child tasks converging on the stated intention?
     (Not just "are tasks completing?" but "is the goal getting closer?")

  2. CHECK FRICTION:
     - Confidence declining across recent steps?
     - Retries accumulating?
     - Corrections increasing?

  3. EVALUATE APPROACH:
     - Is the current decomposition still right?
     - Should remaining tasks be reframed?
     - "What, if anything, surprises me about the current state?"

  4. DECIDE:
     continue  → things are on track
     adapt     → reframe cognitive context for remaining tasks
     escalate  → tell human: "I think we need to rethink this. Here's why."
     stop      → approach isn't working. Surface what was learned.

ROUTING AROUND BLOCKERS:
  When a task is paused (human step, trust gate), continue independent work.
  Don't block the whole goal because one task is waiting.
```

**Integration:** Add a reflection pass to your orchestration loop. Don't just check task completion — evaluate whether the overall approach is converging. Track friction signals. Give the orchestrator permission to adapt or escalate, not just execute.

---

## Pattern 6: Process as Governance Declaration

**Problem:** Processes are treated as workflows (step 1 → step 2 → step 3). They're rigid and break when reality doesn't match.

**Pattern:** A process declares governance, not sequence. It says what must be true, not exactly how to get there.

```
PROCESS DEFINITION:
  name: Quote Generation
  inputs:
    - customer_request (source: email/phone/form)
    - pricing_rules (source: supplier_price_list)
  steps:
    - id: draft_quote
      executor: ai-agent
      cognitive_context:
        framing: analytical
        toolkit: [first-principles]
      quality_criteria:
        - materials priced from current supplier list
        - labour estimated using job-type rules
        - margin applied (25% residential, 20% commercial)
    - id: human_review
      executor: human
      input_fields: [quote_pdf, customer_name, total_amount]
  outputs:
    - quote_document → customer
  trust: supervised  # earned over time
  feedback:
    - track: corrections, accuracy, turnaround_time
    - alert_threshold: correction_rate > 30%

KEY PROPERTIES:
  - Process persists independent of agent. Swap the agent, process stays.
  - Quality criteria are the contract. HOW the agent meets them is the agent's judgment.
  - Conditional routing: steps can branch based on output (route_to / default_next).
  - Human steps: process pauses, creates action item, resumes when human completes.
  - Retry: on failure, retry with error context injected. After max retries, pause for human.
```

**Integration:** Define quality criteria per step, not just a sequence. Let agents decide HOW to meet criteria. Track corrections against criteria to identify which ones the agent struggles with. The process improves through corrections — not through rewriting the process definition.

---

## Pattern 7: Durable Memory

**Problem:** Every agent invocation starts from scratch. No accumulated knowledge.

**Pattern:** Two-scope memory, merged at invocation, with salience sorting.

```
AGENT-SCOPED MEMORY (travels with the agent across all processes):
  - Learned preferences ("this user values conciseness")
  - Correction patterns ("always include source citations")
  - Domain expertise accumulated over time

PROCESS-SCOPED MEMORY (specific to one process):
  - Quality criteria learned from corrections
  - Common edge cases and how they were handled
  - Performance patterns ("bathroom quotes need 20% more labour estimate")

ASSEMBLY:
  At invocation: merge agent + process memories.
  Sort by salience (relevance to current task).
  Apply token budget (most relevant first, within context limit).
  Position-aware: critical context at start and end of prompt.

FEEDBACK-TO-MEMORY BRIDGE:
  Correction captured → pattern detected → memory created.
  Not every correction becomes memory. Only patterns (3+ similar corrections).
```

**Integration:** Maintain persistent memory per agent and per workflow. Merge at invocation. Use salience scoring to prioritise what fits in context. Bridge from corrections to memory: repeated corrections become learned patterns.

---

## Pattern 8: Attention Model

**Problem:** Oversight is either "review everything" or "review nothing." No gradation in HOW the human experiences outputs.

**Pattern:** Trust tiers determine oversight RATE. Attention model determines oversight FORM.

```
THREE ATTENTION MODES:
  item_review → Individual output in review queue. Requires action.
  digest      → Summary in daily brief. No action required.
  alert       → Process-level health notification. Something needs attention.

MAPPING:
  supervised   → item_review (all outputs)
  spot-checked → item_review (sampled) + digest (rest)
  autonomous   → digest only
  critical     → item_review (all outputs, always)

OVERRIDE:
  Low confidence on ANY output → item_review regardless of tier.

SILENCE IS A FEATURE:
  Autonomous process runs cleanly → human sees NOTHING until next digest.
  No notification = things are working.
```

**Integration:** Don't just decide whether to show output to the human. Decide in what form. High-trust processes get summaries. Low-trust processes get individual review. Confidence overrides everything — uncertain output always gets human eyes.

---

## Anti-Patterns to Avoid

```
DON'T: Prescribe cognitive approaches. ("Always use chain-of-thought.")
DO:    Provide cognitive tools. Let the agent choose. Track what works.

DON'T: Auto-upgrade trust. ("50 clean runs → autonomous.")
DO:    Suggest upgrades. Human decides. Always.

DON'T: Require explicit feedback. ("Rate this output 1-5.")
DO:    Capture feedback from natural actions. Edits, approvals, rejections.

DON'T: Treat every run as stateless. ("Here's your prompt. Go.")
DO:    Assemble context from agent memory + process memory + task context.

DON'T: Binary oversight. ("Supervised or autonomous, pick one.")
DO:    Progressive trust with attention modes. Earned, not configured.

DON'T: Reinvent the approach every run.
DO:    Follow a durable process. Improve through corrections, not redesign.

DON'T: Build a noisy approval queue.
DO:    Quiet oversight. Exception-driven. Silence = working.
```

---

## Quick Reference: What to Add to Your Agent System

**Minimum viable harness (start here):**
1. Persistent memory (agent-scoped + workflow-scoped)
2. Implicit feedback capture (diff edits, record approvals/rejections)
3. One review pattern (maker-checker: second agent reviews first agent's output)
4. Trust tracking (approval rate over sliding window)

**Next level:**
5. Cognitive context per step (framing + toolkit + freedom)
6. Metacognitive monitoring ("is this approach working?")
7. Progressive trust tiers with attention modes
8. Pattern detection on corrections ("Teach this?")

**Full harness:**
9. Executive function in orchestrator (reflection cycle)
10. Adaptive scaffolding (model capability × task novelty × trust tier)
11. Cognitive quality in trust (reward calibrated uncertainty)
12. Process as governance declaration (quality criteria, not just steps)

---

## Source

These patterns are from [Ditto](https://github.com/thg/ditto), an open-source harness creator for human-agent collaboration. Architecture specification: `docs/architecture.md`. Key ADRs: 007 (trust earning), 008 (system agents), 010 (workspace model), 011 (attention), 013 (cognitive model for review), 014 (cognitive architecture for execution).

License: AGPL-3.0
