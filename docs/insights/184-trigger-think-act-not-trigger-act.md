# Insight 184: Trigger-Think-Act, Not Trigger-Act

**Date:** 2026-04-14
**Status:** active
**Emerged from:** Production observation — Alex created 261 duplicate "Reached out to Tim" interactions because cycle auto-restart and sendAndRecord both lack deliberation gates
**Affects:** channel.ts (sendAndRecord), heartbeat.ts (cycle auto-restart), relationship-pulse.ts (time-based gate), status-composer.ts (highlight aggregation), tool-resolver.ts (staged dispatch)

## The Insight

Time-based throttles and mechanical retry limits are dumb system rules — they prevent harm but they don't produce intelligent behavior. A real advisor doesn't think "it's been 3 days, time to email Tim." They think "what am I trying to achieve with Tim, what's happened since we last spoke, and does reaching out right now move that forward?"

The architecture must separate three concerns:

1. **Trigger** — decides WHEN to consider an action (time-based tick, event arrival, cycle restart, inbound signal). Triggers are mechanical and cheap.
2. **Think** — decides WHETHER and WHAT to do given full context (interaction history, goal state, person relationship, what changed since last contact). Thinking is an LLM deliberation with the right context assembled.
3. **Act** — executes the decision (send email, record interaction, update status). Acting is mechanical and tracked.

The current system conflates trigger and act — cycle restart triggers outreach execution directly, without a deliberation step that has visibility into what already happened. The relationship pulse gets this right (snapshot → LLM deliberation → act/silence), but even it gates the LLM behind a time-based check, preventing the LLM from reasoning about cases where reaching out sooner might be warranted (e.g., an inbound signal arrived).

**The trigger says "it's time to consider this person." The thinking decides "should I actually do anything?"**

## Three Corollaries

### 1. Context assembly is the quality gate, not time

The quality of an outreach decision is determined by the context the deliberator sees. If the LLM doesn't see "I already emailed Tim twice this week about the same topic," it will rationally decide to email Tim again. The fix isn't throttling — it's assembling the right context: recent interactions, goal state, what's changed, what's pending.

### 2. "Nothing" is always a valid action

Every deliberation point must support "SILENT" as a first-class outcome. The system should never force an action just because a trigger fired. Silence is not a failure mode — it's the advisor deciding "there's nothing useful to do right now."

### 3. Record what was decided, not just what was done

When the deliberator decides NOT to act, that decision should be logged — "considered reaching out to Tim, decided against because last contact was 2 hours ago on the same topic." This creates an audit trail of judgment, not just a log of actions.

## Relationship to Other Insights

- Insight-141 (Proactive Operating Layer): trigger-think-act is the pattern inside the proactive layer
- Insight-145 (Relationship-First): thinking before acting is how you get "5 perfect emails" instead of "261 mechanical ones"
- Insight-166 (Connection First, Commerce Follows): the three litmus tests are a specific instance of the "think" step for connection outreach
- Insight-176 (Deliberative Perspectives): perspectives are a deeper version of the "think" step for high-stakes decisions
- Insight-182 (Plan-Approve-Execute): the plan step is a user-facing version of the "think" step
- ADR-027 (Cognitive Orchestration): the Self's deliberation pattern is the model for how outreach thinking should work

## Implementation Status (Brief 151)

Brief 151 delivered the infrastructure layer for this insight:
- **Dedup safety net** in `sendAndRecord()` — deterministic guard against runaway loops (per-run dedup + 3/person/day cap)
- **Context injection** — cycle auto-restart injects `recentOutreach` into next run's inputs, giving the LLM SENSE/ASSESS steps (the "Think" layer) visibility into what was already done
- **Staged dispatch wiring** — `dispatchStagedAction` now delivers emails through the quality gate pipeline instead of silently discarding them
- **Relationship pulse time gate** reduced from 24h to 4h — the LLM deliberation runs more often while the daily cap prevents over-sending

The existing LLM steps in cycles (SENSE/ASSESS/ACT) and the relationship pulse (`composeProactiveMessage`) serve as the "Think" layer. Brief 151 gave them the right context and added a mechanical safety net. A future brief could add an explicit deliberation checkpoint (LLM call with interaction history before `sendAndRecord`), but the current approach — context injection + dedup guard — addresses the 261-duplicate production bug without adding latency to every outreach call.
