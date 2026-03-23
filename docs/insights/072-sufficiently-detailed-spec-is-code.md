# Insight-072: A Sufficiently Detailed Spec Is Code — Generation Requires Structured Sources

**Date:** 2026-03-23
**Trigger:** Architect session on integration generation. Blog post: "A Sufficiently Detailed Spec Is Code" (Haskell for All, 2026-03). Research report on API-to-tool generation.
**Layers affected:** L1 Process, L2 Agent, L6 Human
**Status:** active

## The Insight

The more precise a specification becomes, the more it necessarily becomes code. You cannot escape complexity — you can only move it between representations. This has three consequences for Ditto:

**1. Process definitions and integration YAMLs ARE a domain-specific language.** They have control flow, type declarations, and execution semantics. Don't pretend they're "just configuration." The question isn't whether users write code — it's whether they write it directly or whether the system generates it from a higher-level interaction.

**2. Generation from natural language alone will fail.** The Symphony example (OpenAI) and the Neon analysis (API tool generation) both show the same failure mode: vague input produces broken output. Ditto's generation pipelines must consume **structured sources** — OpenAPI specs, code analysis, database schemas, industry templates — not raw conversation. Conversation guides intent; formal sources produce the spec.

**3. The human's job is judgment, not authorship.** Dijkstra's observation: avoiding formal notation paradoxically increases communication burden. Ditto's answer is to generate the formal spec from structured sources and let the human react (confirm, correct, refine) rather than author from scratch. This is the architecture's existing "author → editor" shift, now with a theoretical foundation.

The generation quality hierarchy:
- **Highest fidelity:** OpenAPI spec → integration YAML (structured → structured)
- **High fidelity:** Source code + framework conventions → OpenAPI spec → YAML (code → structured → structured)
- **Medium fidelity:** Industry templates + user corrections → process YAML (template → guided refinement)
- **Low fidelity:** Natural language → YAML (will produce broken output without intermediate structure)

Insight-071 says generation must exist. This insight says generation must consume structured sources. Together they constrain the design: the creation path is automated AND formally grounded.

## Implications

1. **`generate-integration` must require a structured input** (OpenAPI spec, MCP schema, or codebase with framework conventions). A flag like `--from conversation` that tries to produce YAML from chat alone should not exist.

2. **Process generation needs an intermediate structured representation** between conversation and YAML. The process-analyst system agent should produce a structured intent (entities, steps, conditions, quality criteria) that is then compiled to YAML — not go directly from "I need an invoicing workflow" to a process definition.

3. **Ditto-built apps should adopt conventions that produce structured specs as a side effect.** If the dev pipeline uses Fastify + fastify-swagger, every app automatically produces an OpenAPI spec. The spec is the structured source; the generation pipeline consumes it. Convention over configuration.

4. **MCP schema ingestion is a structured source.** Services that ship MCP servers already have formal tool definitions. The generation layer should ingest MCP schemas alongside OpenAPI specs — both are structured, both produce reliable YAML.

## Where It Should Land

- **Architecture.md** — the "Process Is the Internal Primitive" section should acknowledge that process definitions are a DSL, not configuration
- **Brief for generation layer** — constraint: structured input required, no natural-language-to-YAML path without intermediate structure
- **ADR-005** — follow-up note: MCP schema ingestion as a generation input alongside OpenAPI
- **Dev pipeline conventions** — fastify-swagger as standard dependency for Ditto-built apps
