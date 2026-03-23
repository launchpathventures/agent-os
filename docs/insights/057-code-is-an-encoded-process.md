# Insight-057: Code Is an Encoded Process

**Date:** 2026-03-23
**Trigger:** ADR-015 design session. Observation that the platform's source code is itself an encoded process — every file, function, and configuration is the output of a Build process run.
**Layers affected:** L1 Process, L2 Agent
**Status:** active

## The Insight

The distinction between "code" and "process definition" is one of encoding, not kind. A YAML process definition and a TypeScript module are both outputs of Build — both evolve through the same meta process pipeline (Goal Framing → Build → Execution → Feedback).

This means the platform literally runs on itself at every level: meta processes govern the creation of the code that implements meta processes. The dev pipeline doesn't just validate the meta process architecture — it IS the meta process architecture operating on its own substrate.

## Why This Matters

This is not an architectural decision (no interfaces or schemas change). It is a design principle that clarifies:
- Why self-referential Build works (it's building the same kind of artifact it runs on)
- Why the dev pipeline is the right first validation target (it exercises the full meta process chain on the platform's own substrate)
- Why "process is the primitive" extends to the platform itself, not just user work

## Where It Should Land

- Referenced from ADR-015 (meta process architecture) as background principle
- Informs how Build's self-modification is reasoned about
