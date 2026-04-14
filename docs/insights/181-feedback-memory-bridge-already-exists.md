# Insight-181: Feedback-to-Memory Bridge Already Exists

**Date:** 2026-04-14
**Trigger:** MP-4.1 triage during sub-roadmap brief design. Codebase exploration revealed `createMemoryFromFeedback()` is fully implemented.
**Layers affected:** L5 Learning
**Status:** active

## The Insight

The meta-process roadmap (MP-4.1) lists "Feedback-to-memory bridge" as a work item to implement. However, this is already fully implemented in `feedback-recorder.ts`:

1. `createMemoryFromFeedback()` (lines 141-220) creates process-scoped correction memories immediately on every edit
2. Deduplication prevents duplicate memories for repeated corrections
3. Reinforcement logic increments confidence: 0.3 → 0.5 → 0.7 → 0.8 → 0.9 (capped)
4. `memoryAssemblyHandler` in `memory-assembly.ts` loads these correction memories for every subsequent execution
5. `checkCorrectionPattern()` detects 3+ corrections and surfaces a notification

The real gap is MP-4.2: the "Teach this?" acceptance action loop. The notification is read-only — accepting it doesn't lock the correction or update process quality criteria.

## Implications

- Sub-roadmap MP-4.1 should be marked as already complete
- The sub-roadmap's "What's broken" section #2 ("No immediate effect") is inaccurate — corrections do affect the next run via process-scoped correction memories
- The three-tier learning model is better than stated: Tier 1 (process memory) is implemented, not just Tier 3 (SLM training)
- Brief 147 focuses on the actual gap (MP-4.2) rather than re-implementing what exists

## Where It Should Land

Update `docs/meta-process-roadmap.md` MP-4 section to reflect current state. Consider updating the "What's broken" narrative to focus on the actual gaps (acceptance loop, quality criteria, evidence).
