# Insight-169: Alex's Capability Surface Is a Set of Concurrent Operating Cycles

**Date:** 2026-04-09
**Trigger:** Brainstorming sales/marketing modes led to the Operating Cycle Archetype (Insight-168). Mapping other potential Alex functions revealed they all instantiate the same pattern — Alex's entire capability surface is concurrent cycles sharing infrastructure.
**Layers affected:** L1 Process (cycle definitions), L4 Awareness (cross-cycle coordination), L6 Human (cycle activation, user-facing capability model)
**Status:** active

## The Insight

Every Alex capability is an operating cycle. The full capability map:

### Core Cycles (designed, ready for implementation)

| Cycle | Primary Identity | External Actions? | Key Differentiator |
|-------|-----------------|-------------------|-------------------|
| **Sales & Marketing** | Alex-as-User | Yes (DMs, emails, content) | Broadcast/direct split, BDR handoff pattern |
| **Network Connecting** | Alex-as-Alex | Yes (introductions) | Institutional reputation, three litmus tests |
| **Relationship Nurture** | Both | Yes (check-ins, value-add) | Silence > noise, reciprocity tracking |

### Next-Tier Cycles (clear use cases, archetype applies directly)

| Cycle | Primary Identity | External Actions? | Key Differentiator |
|-------|-----------------|-------------------|-------------------|
| **Client/Project Management** | Alex-as-User | Yes (status updates, scheduling) | Risk detection, client silence monitoring |
| **Hiring/Recruiting** | Both | Yes (candidate outreach) | Alex-as-Alex as talent connector across network |
| **Financial Operations** | Alex-as-User | Yes (invoices, reminders) | High accuracy bar, slow trust graduation |
| **Reputation & PR** | Alex-as-User | Yes (review responses) | Positive=autonomous, negative=supervised |
| **Vendor/Procurement** | Alex-as-User | Yes (quotes, negotiations) | Cost optimization, vendor performance tracking |

### Emerging Cycles (clear pattern fit, design needed)

| Cycle | Primary Identity | External Actions? | Key Differentiator |
|-------|-----------------|-------------------|-------------------|
| **Community Management** | Alex-as-User | Yes (responses, moderation) | Conflict escalation, contributor recognition |
| **Strategic Intelligence** | Internal only | No | Pure SENSE → ASSESS → BRIEF (no external actions) |
| **Learning & Development** | Internal only | No | Regulatory monitoring, skill gap detection |
| **Personal Admin / EA** | Alex-as-User | Yes (scheduling, booking) | Fast trust graduation, high-frequency low-stakes |

### Cross-Cycle Interactions

Cycles don't operate in isolation. Examples:
- **Sales spots a prospect** → **Intel cycle** researches them → **Connect cycle** finds warm path → **Sales** does outreach with full context
- **Project cycle detects satisfied client** → **Nurture cycle** queues referral ask → **Sales cycle** follows up on referral
- **Hiring cycle sources candidate** → **Connect cycle** makes intro from Alex's network → **Project cycle** onboards new hire
- **Intel cycle detects competitor move** → **Sales cycle** adjusts messaging → **Content queue** produces responsive thought leadership
- **Finance cycle flags overdue payment** → **Project cycle** adjusts client priority → **Nurture cycle** shifts tone

These interactions happen through the process dependency graph (L4) and shared person graph — not through custom integration logic.

### User-Facing Model

Users don't think in cycles. They think in capabilities: "Alex, handle my sales." "Alex, manage my projects." "Alex, keep my books tidy."

Each capability maps to activating one or more cycles. The cycles are invisible infrastructure. The user sees outcomes, work items, and briefings — not process runs and step statuses.

Activation can be explicit ("I want Alex to handle invoicing") or emergent (Alex suggests "I've noticed you're spending 3 hours a week on scheduling — want me to take that over?").

## Implications

1. **Build the archetype infrastructure first, then stamp out cycles.** The seven shared components (Insight-168) are the foundation. Each new capability is incremental.
2. **Cross-cycle coordination is a first-class concern.** The process dependency graph (L4) needs to support cycle-to-cycle triggers, not just process-to-process dependencies.
3. **User activation model matters.** How users discover, activate, and configure cycles is a UX challenge. Not all users need all cycles. Progressive disclosure — start with the one they asked for, suggest others as patterns emerge.
4. **Cycle count is a scaling axis.** A free tier might get 2 cycles. Pro gets unlimited. Enterprise gets custom cycles. This is a natural monetisation dimension.

## Where It Should Land

- `docs/architecture.md` — capability surface section referencing the cycle map
- `docs/roadmap.md` — cycle implementation priority (core → next-tier → emerging)
- `docs/personas.md` — map personas to their likely cycle activation sets
- Future briefs — one per cycle when ready for implementation
