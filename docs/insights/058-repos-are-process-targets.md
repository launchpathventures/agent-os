# Insight-058: Repos Are Process Targets, Not Ditto Instances

**Date:** 2026-03-23
**Trigger:** Architect session — creator asked about multi-repo support. Clarification: each repo is a target for a Ditto process, not a separate Ditto instance. Ditto orchestrates work across repos.
**Layers affected:** L1 Process, L2 Agent, L5 Learning
**Status:** active

## The Insight

Ditto is the orchestrator. Repos (and projects, services, systems) are **targets** that processes operate on. Multi-repo is not "Ditto running in multiple places" — it's "Ditto orchestrating work across multiple targets from a single workspace."

This means the dev pipeline process doesn't live *in* a repo — it's a Ditto process that *targets* a repo. The same dev pipeline process definition could target repo A and repo B, with different contexts (different branches, different conventions, different reviewers). The process is the skill; the repo is the workpiece.

This extends beyond code repos to any target system: a Gmail account, an accounting system, a CRM, a Slack workspace. Ditto is always the orchestrator; targets are always external.

## Implications

- The CLI adapter's assumption of "current working directory" is an implementation detail, not architectural. A cloud adapter could target a remote checkout.
- Process definitions should not embed target-specific configuration. The target is a parameter of the process *run*, not the process *definition*.
- This connects directly to Insight-059 (process context bindings): the same process needs different target configurations per use case.
- Agent tools (read_file, search_files) need to be parameterizable by target — local filesystem today, GitHub API tomorrow, cloud checkout next.
- The integration architecture (ADR-005) already models external services. Repos are just another service type.

## Where It Should Land

- Architecture.md — clarify that processes target external systems, not vice versa
- ADR-005 — repos as a first-class integration type
- Roadmap — cloud execution adapter as a capability item
