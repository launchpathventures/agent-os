# Research Report: Human-in-the-Loop Interface Patterns for AI Agent Oversight

**Date:** 2026-03-23
**Research question:** What novel, practical interface patterns address context overload, orientation, attention management, decision fatigue, and oversight for non-technical users delegating work to AI agents?
**Triggered by:** User research — designing the oversight layer for Ditto's workspace
**Consumers:** Dev Designer (Layer 6 primitives), Dev Architect (ADR-010/011 refinement), Phase 10 MVP brief
**Related research:** `autonomous-oversight-patterns.md`, `trust-visibility-ux.md`, `phase-10-dashboard-workspace.md`, `workspace-interaction-model.md`

---

## 1. Context Overload — Staying Oriented When Agents Produce Volumes

### The Problem

When multiple AI agents run processes concurrently, they can produce more output than a human can meaningfully review. The challenge is not showing all the output — it is showing the *right* output at the *right* time in the *right* density.

### Proven Patterns

**1.1 Confidence-Based Routing (Three-Band Model)**

Source: TikTok content moderation, insurance straight-through processing, financial AML monitoring (documented in `autonomous-oversight-patterns.md`).

The output stream splits into three bands:
- **Auto-approve** (high confidence, >85% of outputs) — logged but not surfaced
- **Human review** (uncertain middle band, 5-15%) — the only things that reach the user
- **Auto-reject/escalate** (clear failures) — flagged and blocked

The key insight: the human never sees the full volume. They see the *interesting* volume. This is how a trades business manager should experience Ditto — they see the 3 invoices that look weird, not the 47 that processed fine.

**1.2 Summaries Over Streams**

Source: Apple Intelligence notification summaries, email digest patterns.

Instead of streaming individual outputs, aggregate into summaries at natural boundaries:
- **Per-process summaries:** "Marketing emails: 12 sent, 3 need review (low confidence on tone)"
- **Per-time-window summaries:** "Since you were last here: 8 processes ran, 2 need attention"
- **Per-outcome summaries:** "Goal: Q2 marketing plan — 4 of 7 sub-tasks complete, 1 blocked"

Apple's pattern is instructive: notification summaries on the lock screen show "3 messages from Sarah about the project deadline" rather than 3 separate notifications. The density is manageable; the information scent is strong.

**1.3 The Newspaper Front Page Pattern**

Source: Edward Tufte's information design principles, editorial design.

A newspaper solves exactly this problem: enormous amounts of content, organized so you can orient in seconds. The front page pattern:
- **Headline** = what matters most right now (exceptions, decisions needed)
- **Above the fold** = active work with status changes since last visit
- **Section headers** = process categories or goal areas
- **Below the fold** = running smoothly, here if you want it

Each headline has strong information scent — you can tell whether to read further or skip. The trades business manager sees "2 quotes need approval — $14K total" above the fold, not a list of all processes.

### Novel Patterns (Ditto-Original)

**1.4 The "Quiet Shift Report"**

Instead of a dashboard of metrics, Ditto tells you what happened as a *narrative* when you arrive:

> "While you were away (6 hours): 4 client quotes were generated and sent. One quote for Henderson Plumbing was held because the line items looked unusual — the copper pipe price was 40% higher than your typical range. Two new leads came in from the website form and were added to your pipeline. The weekly cost report is ready for review."

This works because:
- It respects the human's time boundary (since you were away)
- It leads with exceptions (the held quote)
- It provides counts for routine work (4 quotes sent)
- It signals what needs action vs. what is informational
- It reads like a handover from a competent team member, not a database query

The narrative format matters. Lists feel like work. Stories feel like a briefing. The non-technical user doesn't need to parse a dashboard — they absorb a paragraph.

**1.5 The "Information Budget" Pattern**

Each arrival at the workspace has an attention budget. The system estimates how many items the user can meaningfully process (based on historical engagement, time of day, device) and caps what it shows:

- **Mobile, quick check:** 1-3 items maximum, highest priority only
- **Desktop, morning session:** 5-10 items, mixed priority
- **Deep review mode (user-initiated):** Full queue, all details

The items not shown are not hidden — they are deferred with a clear "and 7 more things running smoothly" indicator. The user can pull more; the system does not push more than the budget.

---

## 2. Orientation at a Glance — "What's Going On Right Now?"

### Physical-World Metaphors That Transfer

**2.1 Airport Departure Board**

The departure board is a masterpiece of glanceable information design:
- **Fixed structure** — same columns every time (destination, time, gate, status)
- **Exception coloring** — green for on-time, amber for delayed, red for cancelled
- **Sort by relevance** — next departures first, not alphabetical
- **Progressive detail** — board gives overview, individual screens give detail

For AI agent oversight, this translates to:
- Fixed columns: process name, last activity, status, needs attention (yes/no)
- Exception coloring: green = running fine, amber = needs review, red = blocked/failed
- Sort by urgency, not alphabetical or chronological
- Click to expand shows full process state

**2.2 Hospital Ward Board**

The ward board shows patient status for a nurse managing 8-12 patients:
- **One row per patient** (one row per process)
- **Key vitals as icons** (temperature, pain score, medication due)
- **Color coding for acuity** (red = critical, yellow = watch, green = stable)
- **Time-based flags** (overdue medication highlighted)

The nurse does not read the full chart for every patient every shift. They scan the board, identify who needs attention, and go deep on those. This is exactly how a business manager should oversee AI processes.

**2.3 Trading Floor Heat Map**

Traders monitor hundreds of instruments by encoding state as color intensity on a spatial map:
- **Position = category** (sector, asset class, geography)
- **Color = direction** (green = up, red = down)
- **Intensity = magnitude** (bright = significant move, dim = noise)

For AI oversight: a spatial map of processes where color intensity shows "how much has changed since you last looked." Bright spots need attention. Dim spots are stable. This is a genuine ambient display — you can glance at it from across the room.

**2.4 Basecamp Hill Chart (Proven Pattern)**

Source: Basecamp Shape Up methodology.

Each scope (process/task) is a dot on a hill. Left slope = figuring it out (uncertainty). Right slope = executing (certainty). The position shows progress. A dot that does not move is a raised hand: "something might be wrong here."

Key insight: hill charts show *qualitative* progress (are we past the hard part?) not just *quantitative* progress (what % is done?). A process at 80% complete but stuck on the hill's upward slope is more concerning than one at 30% but rolling downhill.

For AI oversight: each process dot moves along the hill. The human scans for stuck dots and anomalous movements. No numbers needed. Pure spatial pattern recognition.

### Novel Patterns (Ditto-Original)

**2.5 The "Heatmap Heartbeat"**

A grid view of all active processes where each cell pulses at a rate proportional to activity level:

- **Steady, slow pulse** = running normally, expected cadence
- **Fast pulse** = high activity, producing lots of output
- **No pulse** = idle or complete
- **Irregular pulse** = anomalous behavior (unexpected activity pattern)

The human develops an intuitive feel for what "normal" looks like, and deviations catch the eye without requiring any text or numbers. This is ambient in the truest sense — it works with peripheral vision.

**2.6 The "Weather Report" Metaphor**

Instead of dashboards, present system state as a weather forecast:

- **Current conditions:** "Clear skies — all processes running normally"
- **Watch areas:** "Scattered clouds over client onboarding — 2 items pending review"
- **Forecast:** "Storm likely tomorrow — 5 quarterly reports due, expect high review volume"

This works for non-technical users because weather is universally understood as a risk/attention metaphor. It combines current state, areas of concern, and forward-looking prediction in a familiar frame.

---

## 3. Attention Management — What to Show vs. Hide

### Academic Foundations

**3.1 Calm Technology Principles (Weiser & Brown 1996, Amber Case 2015)**

Source: calmtech.com, Mark Weiser's "The Coming Age of Calm Technology" (1996).

Eight principles, distilled for AI oversight:

1. **Smallest possible attention** — default to periphery, move to center only when needed
2. **Inform and encalm** — primary activity should not be monitoring AI; AI monitoring should be secondary
3. **Peripheral to central transitions** — information should move smoothly between background awareness and focused attention
4. **Amplify best of both** — AI handles volume, human handles judgment (never the reverse)
5. **Non-verbal communication** — use color, motion, sound, haptics before text
6. **Graceful failure** — when the system cannot decide, it should default to a safe, usable state (surface for review)
7. **Minimal viable technology** — strip features to the minimum that solves the oversight problem
8. **Respect social norms** — do not interrupt inappropriately; match the user's work rhythm

The key design implication: the default state of the Ditto workspace should be *calm*. No flashing, no badges, no notification counts. Just a quiet surface that subtly indicates everything is running. When something needs attention, the transition from calm to alert should be smooth and proportional to urgency.

**3.2 Management by Exception**

Source: Frederick Taylor (1911), modern application in ERP systems, financial auditing.

The principle: only report deviations from expected outcomes. Everything within normal parameters is invisible.

Implementation requires:
- **Defined expectations** per process (what does "normal" look like?)
- **Tolerance bands** (how much deviation before flagging?)
- **Escalation tiers** (minor deviation = log, moderate = notify, major = block)

For Ditto: each process has an expected output profile. The system compares actual outputs against expectations and only surfaces deviations. A marketing email that matches the brand guidelines is invisible. A marketing email that sounds angry is surfaced.

**3.3 Information Scent (Pirolli & Card, 1999)**

Source: NNGroup research on information foraging theory.

Users decide where to invest attention based on "scent" — cues that signal the value of going deeper. Strong scent = clear signal of what you will find. Weak scent = ambiguous, users skip it.

For AI oversight, every surfaced item needs strong scent:
- BAD: "Process output ready for review" (no scent — what process? what output? why?)
- GOOD: "Henderson Plumbing quote held — copper pipe price 40% above typical" (strong scent — I know exactly what this is and why it matters)

**3.4 Selective Attention and the Von Restorff Effect**

Source: Laws of UX (lawsofux.com).

- **Selective attention:** Humans filter stimuli to focus on goal-relevant information. Design must support this filter, not fight it.
- **Von Restorff effect:** Items that are visually different from their surroundings are noticed and remembered. Use this for exceptions — the one amber item in a sea of green catches the eye.
- **Hick's Law:** Decision time increases logarithmically with the number of choices. Fewer items to review = faster decisions. Confidence-based routing directly reduces the choice set.

### Novel Patterns (Ditto-Original)

**3.5 The "Attention Dial"**

A user-controlled setting that adjusts the threshold of what gets surfaced:

- **Hands-off** (rightmost position): Only show blocked items and failures. Maximum autonomy.
- **Spot-check** (middle): Show exceptions plus a random sample. Balanced oversight.
- **Engaged** (leftmost position): Show everything. Full visibility.

The dial position can be set globally and overridden per process. Over time, the system suggests dial adjustments: "You have not reviewed any marketing emails in 3 weeks. Should I move the dial to hands-off for that process?"

This makes the oversight level tangible and controllable. The user feels agency over how much the system demands of them.

**3.6 The "Tide Line" Pattern**

A horizontal line on the process list that separates "needs you" (above) from "handled" (below). Items float above or below the tide line based on confidence, urgency, and trust level.

The tide line rises and falls:
- **Low tide** (line near bottom) = most things handled autonomously, few items above
- **High tide** (line near top) = lots needing review, system is uncertain or new

The user's goal is to keep the tide low. When they review items, the line drops. When new uncertain work arrives, it rises. The metaphor is intuitive: you want calm waters, and a rising tide signals attention needed.

---

## 4. Decision Fatigue in Review Flows

### The Core Problem

Reviewing AI output is cognitively expensive. Each review requires:
1. Understanding what was produced
2. Evaluating whether it is correct
3. Deciding to approve, edit, or reject
4. If editing, making the correction

Multiplied across many outputs, this depletes decision-making capacity. The result: rubber-stamping (approving without reviewing) or avoidance (not reviewing at all). Both defeat the purpose of human oversight.

### Proven Patterns

**4.1 Diff-First Review**

Source: GitHub pull request reviews, code review workflows, Google Docs suggestion mode.

Never show the full output for review. Show what *changed* or what is *unusual*:
- **Against template:** Highlight deviations from the expected output pattern
- **Against previous:** Show what is different from the last time this process ran
- **Against expectation:** Flag specific values that fall outside normal ranges

Cursor's AI code review demonstrates this well: the interface shows inline diffs with clear visual indicators of additions and deletions. BugBot identifies specific lines with issues rather than asking users to review entire files.

For a trades business manager reviewing a quote: do not show the full 3-page quote. Show: "Price is $14,200 (typical range: $10K-$16K). Line item flagged: copper pipe at $8.50/ft (your usual: $5.20/ft). Everything else matches template."

**4.2 Batch Review with Natural Grouping**

Source: Email triage workflows, Superhuman's processing model, content moderation queues.

Group items for batch processing:
- **By type:** Review all quotes together, then all emails, then all reports
- **By confidence band:** All high-confidence items first (quick approve), then medium (careful review)
- **By process:** All outputs from one process in sequence (context stays loaded)

Batch review reduces context-switching cost. Reviewing 5 quotes in a row is less fatiguing than reviewing quote-email-report-quote-email because the evaluation criteria stay loaded in working memory.

**4.3 Sampling Strategies (Spot-Check, Not Review-All)**

Source: Statistical quality control (Deming, Shewhart), financial audit sampling, Ditto's own trust tier model.

Not every output needs review. Sampling strategies:
- **Random sampling:** Review N% of outputs, selected randomly (Ditto's current SHA-256 approach)
- **Stratified sampling:** Review more from high-risk processes, less from proven ones
- **Adaptive sampling:** Increase sampling rate when errors are found, decrease when quality is consistent
- **Confidence-weighted sampling:** Always review low-confidence outputs, occasionally review high-confidence ones

The sampling rate should be visible to the user: "Reviewing 1 in 5 marketing emails (last 10 reviewed: 0 corrections needed)." This builds trust in the sampling approach itself.

**4.4 Confidence-Based Triage (Pre-Sorted Review Queue)**

Source: Medical triage, content moderation platforms, insurance underwriting.

Present the review queue pre-sorted by confidence/risk:
- **Top of queue:** Lowest confidence items (most likely to need correction)
- **Bottom of queue:** Highest confidence items (most likely fine, review optional)
- **Clear confidence indicators:** Show why the system flagged each item

The user can stop reviewing when they feel confident in the system's judgment. If the first 3 items in the queue are indeed problematic and the next 3 are fine, they can reasonably skip the remaining high-confidence items.

### Novel Patterns (Ditto-Original)

**4.5 The "3-2-1 Review" Pattern**

A structured micro-review format that takes <30 seconds per item:
- **3 key facts** the system presents (what was produced, confidence level, one notable detail)
- **2 options** the user chooses between (approve or flag for deep review)
- **1 action** that resolves the item

This is the minimum viable review. It prevents the user from needing to read full outputs for routine approvals. Deep review is always available but is not the default path.

Example for a quote review:
- 3 facts: "Quote for Henderson Plumbing | $14,200 | All line items within typical range"
- 2 options: [Approve & Send] [Review Details]
- 1 action: User taps Approve & Send

**4.6 The "Review Energy" Budget**

The system tracks how many items the user has reviewed in the current session and adjusts the queue accordingly:
- **Fresh (0-5 reviews):** Show full details, invite careful review
- **Engaged (5-15 reviews):** Switch to summary mode, reduce detail per item
- **Fatigued (15+ reviews):** Suggest stopping, defer remaining items, or switch to approve-all-high-confidence mode

Source inspiration: Attention tracking research, Pomodoro technique, focus session design.

The system never shows 50 items to review. It shows 10, then checks: "You have reviewed 10 items. 15 more are in the queue. Want to continue, or should I auto-approve the high-confidence ones and save 3 items for tomorrow?"

**4.7 The "Correction Velocity" Display**

Show the user how their corrections are changing the system over time:
- "You have corrected 12 quotes this month. Your correction rate has dropped from 15% to 4%."
- "The system has learned: copper pipe prices should include seasonal markup. No corrections needed on the last 8 quotes."

This serves two purposes: it prevents the feeling that review is a Sisyphean task (the system is getting better), and it provides evidence for when to reduce oversight (correction velocity approaching zero = safe to move to hands-off).

---

## 5. Novel Interaction Patterns for AI Oversight

### 5.1 The "Trust Thermometer" — Ambient System Health

A single ambient indicator (like a thermostat display) that encodes the overall system health:

- **Cool blue:** Everything running normally, no attention needed
- **Warm yellow:** Some items need review, nothing urgent
- **Hot red:** Something is wrong, blocked, or failing

The thermometer is always visible — in the corner of the screen, on the mobile home screen widget, in the menu bar. It is the most minimal possible representation of "do I need to open Ditto right now?"

Implementation: aggregate confidence scores, error rates, queue depth, and staleness across all active processes into a single 0-100 health score. Map to color gradient.

### 5.2 The "Teaching Moment" Pattern — Right-Frequency Learning

The system needs to learn from corrections, but asking "did I get this right?" after every output creates notification fatigue. The teaching moment pattern:

- **Never ask about high-confidence outputs** that were approved without edits (the approval IS the signal)
- **Ask about corrections:** When the user edits an output, ask one targeted question: "Should I always use seasonal pricing for copper pipe, or was this a one-time adjustment?"
- **Ask about patterns:** After 3+ similar corrections: "I have noticed you always change the greeting from 'Dear' to 'Hi' in client emails. Should I make this the default?"
- **Batch learning prompts:** Group learning questions into a weekly "calibration session" (5 minutes) rather than interrupting workflow

The frequency is calibrated to the correction velocity: lots of corrections = more frequent teaching moments. Few corrections = rare, batched check-ins.

### 5.3 The "Walk the Floor" Pattern — Periodic Structured Sampling

Inspired by how a manager walks the factory floor — not checking everything, but getting a feel for whether things are running smoothly.

The system offers a periodic "walk" that:
1. Selects one output from each active process at random
2. Presents them in quick succession (card-swipe interface)
3. For each: "This is what [process] produced. Looks right?" [Yes] [Hmm, let me look]
4. Takes 2-5 minutes total
5. Suggested at natural transition points (morning, after lunch, end of day)

This is not review — it is *calibration*. The user builds an intuitive sense of quality across all processes without reviewing exhaustively. If something feels off, they can drill into that process.

### 5.4 The "Exception-Only Surface" — Nothing Unless Something Needs You

A dedicated view (or the default view) that shows literally nothing when everything is fine:

- Empty screen with the message: "All quiet. 7 processes running. 23 outputs produced since last check. Nothing needs your attention."
- When something needs attention, it appears with full context
- Items auto-dismiss when resolved (by the user or by the system self-correcting)

This is the opposite of a dashboard. Dashboards show everything. The exception surface shows nothing — and that nothingness is the primary signal of health. For the non-technical user, an empty screen means "your business is running."

Contrast with: Linear's inbox, which shows all assigned items. The exception surface would only show items where something went wrong or needs judgment.

### 5.5 The "Standup" Pattern — Brief Structured Status at Ritual Times

Inspired by daily standup meetings, but between the user and their AI team:

At a configured time (or when the user first opens Ditto), present a 60-second structured briefing:
- **What was completed** since last standup (counts, not details)
- **What is in progress** (active processes and their stage)
- **What is blocked** (items needing human input, with direct action links)

Format: conversational narrative, not bullet points. The Self (Ditto's conversational identity) delivers this like a team lead giving a morning briefing.

### 5.6 The "Quality Audit" Pattern — Periodic Deep Dive

Monthly or quarterly, the system initiates a structured review:
- Select a random sample of outputs from the past period
- Present them with the system's confidence scores alongside
- Ask the user to grade each one (correct / acceptable / wrong)
- Compare user grades to system confidence: are they aligned?
- Surface insights: "Your grading matched system confidence 94% of the time. For marketing emails, alignment was only 72% — the system may need recalibration."

This serves the same function as a financial audit: periodic, systematic verification that ongoing quality is maintained. It is not triggered by exceptions but by time, ensuring quality does not silently degrade.

---

## 6. Physical-World Management Analogies — Translated to AI Oversight

### 6.1 The Manager's Toolkit (Analog Patterns)

| Management Pattern | How It Works IRL | Translation to AI Oversight |
|---|---|---|
| **Walk the floor** | Manager physically visits workstations, observes activity, asks questions | Periodic random sampling of outputs from each process; card-swipe quick review |
| **Exception report** | Only get a report when KPIs fall outside thresholds | Confidence-based routing; exception-only surface; notification only on anomalies |
| **Standup meeting** | 15-min daily sync: done, doing, blocked | Quiet shift report / standup pattern at ritual times |
| **Quality audit** | Quarterly deep-dive into a sample of work | Periodic structured review with grading and calibration scoring |
| **Delegation with check-ins** | Assign work, set expectations, schedule check-ins proportional to trust | Trust tiers with configurable review frequency; the attention dial |
| **New hire supervision** | Watch closely at first, gradually give autonomy as competence is proven | Supervised tier → spot-checked → autonomous; trust-earning with correction velocity tracking |
| **Shift handover** | Outgoing shift briefs incoming shift on what happened and what needs attention | Quiet shift report: narrative summary of what happened while user was away |
| **Team retrospective** | Periodic reflection: what worked, what didn't, what to change | Quality audit + correction velocity display: is the system improving? |

### 6.2 Why These Analogies Work for Non-Technical Users

The trades business manager already manages a team this way. They do not micromanage every electrician on every job — they:
1. Set expectations (process definitions)
2. Check in periodically (walk the floor)
3. Get called when something is wrong (exception escalation)
4. Do deep reviews occasionally (quality audit)
5. Increase supervision for new hires (trust tiers)
6. Decrease supervision for trusted veterans (autonomous tier)

Ditto should feel exactly like this, but for AI processes instead of human employees. The interface should use the same vocabulary and rhythms the user already understands from managing people.

### 6.3 The "Firm, Not Bureaucracy" Principle

Source: User's "firm, not playbook" feedback applied to oversight.

Real firms have:
- **Culture** (shared expectations that do not need to be written down) → process templates and learned preferences
- **Trust relationships** (some people are more trusted than others) → trust tiers
- **Informal check-ins** (hallway conversations, not formal reviews) → quick glance, ambient indicators
- **Formal governance** (quarterly reviews, annual audits) → quality audits, calibration sessions

Bureaucracies have:
- **Approval queues for everything** → what Ditto must avoid
- **Forms and checklists** → excessive review friction
- **Equal scrutiny regardless of track record** → ignoring trust tiers

The oversight UX must feel like a well-run firm, not a bureaucracy. The default is trust. Review is proportional. Escalation is the exception, not the rule.

---

## 7. Key UX Laws Applied to AI Oversight

| Law | Implication for Ditto |
|---|---|
| **Hick's Law** (decision time ~ log of choices) | Minimize items in review queue. Confidence routing reduces the choice set. 3-2-1 review reduces decisions per item. |
| **Miller's Law** (7±2 items in working memory) | Cap review sessions at ~7 items before suggesting a break. Group by type for batch review. |
| **Von Restorff Effect** (different things stand out) | Make exceptions visually distinct. One amber dot in a sea of green is immediately noticed. |
| **Zeigarnik Effect** (incomplete tasks are remembered) | Show pending review items as a subtle persistent indicator, not a badge count. The user knows it is there. |
| **Peak-End Rule** (experiences judged by peak and end) | End review sessions with a positive summary: "You reviewed 8 items in 4 minutes. 0 corrections needed." |
| **Selective Attention** | Support the user's filtering goal. Sort by relevance. Hide resolved items. Show information scent on every item. |
| **Choice Overload** | Never present "approve / edit / reject / skip / defer / escalate." Present "approve / needs work." |
| **Cognitive Load** | Shift cognitive work to the system. Show diffs, not full outputs. Pre-categorize, do not ask users to triage. |
| **Tesler's Law** (complexity cannot be eliminated) | Accept that oversight has inherent complexity. Manage it with good defaults, not by pretending it does not exist. |

---

## 8. The Microsoft 18 Guidelines Applied to Agent Oversight

Source: Amershi et al., "Guidelines for Human-AI Interaction," CHI 2019.

Relevant guidelines for Ditto's oversight layer:

| # | Guideline | Application to Ditto |
|---|---|---|
| G1 | Make clear what the system can do | Show process capabilities and limitations explicitly per process |
| G2 | Make clear how well the system can do it | Confidence scores, correction velocity, accuracy rates visible per process |
| G3 | Time services based on context | Standup at morning, shift report after absence, not random interruptions |
| G4 | Show contextually relevant information | Review items include why they were flagged, not just that they were flagged |
| G8 | Support efficient dismissal | One-tap approve for high-confidence items. Swipe to dismiss. |
| G9 | Support efficient correction | Edit in place. Selection-based correction. Teach the system from corrections. |
| G11 | Make clear why the system did what it did | Explain confidence scores: "Flagged because price is 40% above typical range" |
| G13 | Learn from user behavior | Correction velocity. Teaching moments. Preference learning from approvals/edits. |
| G14 | Update and adapt cautiously | Do not change behavior drastically from one correction. Batch learning. Confirm pattern changes. |
| G15 | Encourage granular feedback | Teaching moment questions. Quality audit grading. Not just approve/reject. |
| G17 | Provide global controls | The attention dial. Per-process trust overrides. Notification preferences. |

---

## 9. Synthesis: The Ditto Oversight Stack

Combining all research into a layered oversight model:

### Layer 0: Ambient Awareness (Always On, Zero Effort)
- Trust thermometer (single color indicator of system health)
- Heatmap heartbeat (pulse visualization of process activity)
- Weather report status ("clear skies" / "watch areas")

### Layer 1: Arrival Briefing (When You Show Up, 60 Seconds)
- Quiet shift report (narrative of what happened since last visit)
- Standup pattern (completed / in progress / blocked)
- Exception count ("3 items need you")

### Layer 2: Active Review (When You Choose to Engage, 5-15 Minutes)
- Exception-only surface (only items needing judgment)
- 3-2-1 review format (quick triage per item)
- Diff-first presentation (what changed, not the whole thing)
- Batch grouping (by type, confidence, process)
- Review energy budget (session caps with graceful off-ramps)
- Tide line visualization (needs-you above, handled below)

### Layer 3: Calibration (Periodic, 5 Minutes Weekly)
- Walk the floor (random sample from each process)
- Teaching moments (batched learning questions)
- Correction velocity display (is the system improving?)
- Attention dial adjustment suggestions

### Layer 4: Deep Audit (Periodic, 30 Minutes Monthly/Quarterly)
- Quality audit with grading
- Confidence calibration check (do system scores match user judgment?)
- Process performance review (which processes need tuning?)
- Trust tier adjustment recommendations

### Guiding Principles

1. **Calm by default, alert by exception** — the workspace should be quiet when things are working
2. **Narrative over metrics** — tell stories, not show dashboards (for non-technical users)
3. **Budget attention explicitly** — cap review sessions, suggest breaks, auto-approve when fatigued
4. **Show the system learning** — correction velocity, teaching moments, accuracy trends make review feel productive, not Sisyphean
5. **Match real-world management rhythms** — morning briefing, periodic walk, monthly audit are patterns the user already knows
6. **Minimize decisions per review** — 3-2-1 format, binary choices, pre-sorted queues
7. **Strong information scent** — every surfaced item tells you why it is there and what you will find

---

## 10. Source Bibliography

### Academic / Research
- Amershi et al., "Guidelines for Human-AI Interaction," CHI 2019 (18 guidelines)
- Pirolli & Card, Information Foraging Theory (1999) — information scent
- Weiser & Brown, "The Coming Age of Calm Technology" (1996) — calm technology principles
- Amber Case, "Calm Technology" (2015) — 8 principles for attention-respecting technology
- Bansal et al., "Does the Whole Exceed its Parts?" (2021) — human-AI decision making
- Laws of UX (lawsofux.com) — 30 UX laws including Hick's, Miller's, Von Restorff, Zeigarnik

### Product Research
- Apple Intelligence — notification summaries, contextual integration, consent-before-sharing
- Cursor — inline diffs, BugBot line-by-line review, task progress display ("12 files explored"), autonomy sliders
- Devin — four-step workflow visualization (Ticket-Plan-Test-PR), real-time takeover capability
- Basecamp Shape Up — hill charts for qualitative progress, scope-based visibility
- Superhuman — email triage patterns, keyboard-first processing
- Linear — "calmer interface" design philosophy, inbox patterns
- MetaGPT — SOP-encoded multi-agent verification

### Design Frameworks
- Google PAIR Guidebook — feedback collection, trust calibration through transparency, control balancing
- Anthropic "Building Effective Agents" — checkpoint-based oversight, transparency of planning steps, sandboxed testing
- Maggie Appleton — "squish vs structure" in AI interfaces, compositional/chained reasoning, spell-check-sized tools
- Geoffrey Litt — end-user programming with LLMs, Betty/Buzz collaboration model
- Bret Victor — ladder of abstraction, fluid movement between concrete and abstract views
- Edward Tufte — data-ink ratio, sparklines, small multiples, information density
- NNGroup — progressive disclosure (max 2 levels), information scent, AI paradigm shift (intent-based UI)

### Management Science
- Frederick Taylor — management by exception (1911)
- Agile Alliance — information radiators
- Atlassian — decision fatigue prevention (6 strategies)
- Charity Majors / Honeycomb — observability principles for understanding complex systems

### Calm Technology Sources
- calmtech.com — 8 principles, communication patterns (haptic, status lights, trend graphs, delays, timed triggers)
- Notification fatigue research — permission timing, value-first approach, batching, relevance filtering
