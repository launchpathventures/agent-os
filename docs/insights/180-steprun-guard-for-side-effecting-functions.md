# Insight-180: Step-Run Guard for Side-Effecting Functions

**Date:** 2026-04-14
**Trigger:** Brief 141 review — `publishPost()` must only be callable from within step execution (ADR-029)
**Layers affected:** L3 Harness
**Status:** active

## The Insight

Functions that produce external side effects (social publishing, payments, webhook dispatches) should require a `stepRunId` parameter as a programmatic invocation guard. This proves the call originates from within the harness pipeline, where trust gates, outbound quality checks, and audit logging are enforced.

Convention-based constraints ("only call this from step execution") are insufficient — they rely on developer discipline and don't fail loudly when violated. A required `stepRunId` parameter makes the constraint self-enforcing: the function simply won't execute without proof of harness context.

## Implications

- `publishPost()` is the first function to use this pattern (Brief 141). Apply it to any future side-effecting functions that must traverse the harness pipeline.
- The guard is lightweight: one parameter check at function entry. No need for a full context object or dependency injection.
- Test mode (`DITTO_TEST_MODE`) bypasses the guard since test calls don't have real step runs.
- This complements (not replaces) the outbound-quality-gate handler — the gate checks content quality, the guard checks invocation context.

## Where It Should Land

Architecture spec L3 (Harness): document as a pattern for harness-governed side effects. Candidate for a utility type or wrapper function if more functions adopt the pattern.
