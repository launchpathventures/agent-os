# Agent OS — AI Agent Instructions

## What This Project Is

Agent OS is a platform for human-agent collaboration. It helps people define, monitor, review, and improve agent-operated business processes.

## Architecture

Read `docs/architecture.md` for the full architecture spec — six layers, 16 UI primitives, borrowing strategy, and build phases.

## Key Concepts

- **Process** — the atomic unit. Inputs → steps → outputs, with quality criteria and feedback loops.
- **Agent** — executes process steps. Can be AI, script, rules engine, or human.
- **Harness** — review patterns where agents check each other's work.
- **Trust tier** — per-process autonomy level, earned through track record.
- **Feedback loop** — implicit capture (edits ARE feedback) that drives learning.

## Conventions

- Use `pnpm` for package management
- TypeScript strict mode
- Follow the borrowing strategy — compose proven patterns, don't reinvent

## Project Structure

```
docs/           # Architecture specs and design docs
src/
  engine/       # Headless engine — heartbeats, adapters, harness
  api/          # API layer — process CRUD, runs, feedback
  ui/           # Frontend — 16 universal primitives
  adapters/     # Agent runtime adapters (Claude, scripts, HTTP)
processes/      # Process definitions (YAML/JSON)
agents/         # Agent configurations
```

## First Implementation

Agentic coding team — see `docs/architecture.md` "First Implementation" section.
