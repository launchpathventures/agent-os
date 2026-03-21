# Insight-049: Consultative, Not Configurative

**Date:** 2026-03-21
**Trigger:** README rewrite — realisation that the "technologist gap" is as fundamental as the trust/memory/cognition gaps. Every AI tool today forces users to think like technologists (prompts, workflows, triggers, configs). Ditto's target users are domain experts, not systems thinkers.
**Layers affected:** L6 Human (all interaction surfaces), L1 Process (definition UX)
**Status:** active

## The Insight

Every agentic framework, chat agent, and AI tool today requires the user to think like a technologist: write prompts, draw workflow diagrams, configure triggers and actions, debug integrations. The people who most need AI to handle their operational work are the least likely to speak that language. They're domain experts — they know what "good" looks like — but they've never needed to express their knowledge as a flowchart or a prompt.

Ditto's interaction model must be **consultative, not configurative.** The system asks questions the way a good consultant would — one at a time, in the user's language, building understanding progressively. The user describes their work the way they'd explain it to a smart new hire. The system builds the structure around their answers.

This is distinct from "no-code" or "low-code" — those paradigms still require systems thinking (visual programming is still programming). Consultative means the user never sees the underlying structure unless they want to. They describe outcomes and standards. The system infers process, quality gates, and governance.

## Design test

For any interaction: "Could a trades business owner do this from their phone between jobs, using the same language they'd use explaining the work to their foreman?" If the answer is no, the interaction is too configurative.

## Implications

- Process creation is conversation-first, not form-first or builder-first
- The process-analyst agent's primary mode is asking questions, not presenting options
- Error messages must be in domain language ("the quote was missing the labour estimate"), not system language ("step 3 output validation failed")
- The system should never require the user to understand its internal structure (layers, handlers, trust tiers) to use it — those concepts are exposed through metaphor (teammate, delegation, earning trust)
- This principle applies equally to the CLI (current) and web dashboard (Phase 10)
