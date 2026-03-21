# ADR-001: SQLite via Drizzle ORM for Storage

**Date:** 2026-03-18
**Status:** accepted

## Context

Ditto needs persistent storage for process definitions, runs, outputs, feedback, and the activity trail. The original implementation used Postgres via Drizzle ORM, requiring a running Postgres server — too heavy for dogfood development.

The architecture calls for zero-setup: `pnpm install` + `ANTHROPIC_API_KEY` should be the only requirements. A local database that lives in the repository's `data/` directory (gitignored) meets this requirement.

SQLite is the right fit because:
- Zero infrastructure — no server process, no connection string, no Docker
- Single-file database — easy to inspect, back up, reset
- WAL mode provides adequate concurrency for single-user dogfood
- Drizzle ORM supports SQLite via better-sqlite3, allowing a dialect swap without rewriting queries

## Decision

Replace Postgres with SQLite using better-sqlite3 as the driver and Drizzle ORM as the query layer.

- **Schema:** `pgTable` → `sqliteTable`, `pgEnum` → text columns with TypeScript union types, `uuid` → text with `crypto.randomUUID()`, `jsonb` → text with `mode: 'json'`, `timestamp` → integer with `mode: 'timestamp_ms'`, `boolean` → integer with `mode: 'boolean'`
- **Connection:** better-sqlite3 with WAL mode and foreign keys enabled
- **DB location:** `data/ditto.db`, auto-created on first run
- **Schema sync:** `drizzle-kit push` (destructive sync, acceptable for dogfood)

No data model changes — same tables, same columns, same relationships. This is a driver swap.

Agent identity fields added to the `agents` table (ownerId, organisationId, permissions, provenance) as nullable columns for governance readiness per the Phase 1 brief.

## Provenance

- **Source project:** antfarm (https://github.com/snarktank/antfarm)
- **Source files:** `/src/db.ts` — SQLite + WAL + JSON context storage
- **What we took:** Zero-setup SQLite pattern with WAL mode, auto-create data directory
- **What we changed:** Used Drizzle ORM instead of raw better-sqlite3 queries; preserved the existing data model from the Postgres schema

Additional pattern source:
- **Source project:** bun-elysia-drizzle-sqlite (https://github.com/remuspoienar/bun-elysia-drizzle-sqlite)
- **Source files:** Schema definition patterns using `sqliteTable`
- **What we took:** Drizzle SQLite schema patterns (sqliteTable, text mode json, integer mode timestamp_ms)
- **What we changed:** Applied to Ditto's richer data model (11 tables vs their simpler schema)

## Consequences

- **Easier:** Fresh clone → `pnpm install` → `pnpm cli sync` → working. No Postgres setup.
- **Easier:** Database inspection via any SQLite tool (DB Browser, sqlite3 CLI, Drizzle Studio).
- **Easier:** Reset by deleting `data/ditto.db`.
- **Harder:** Concurrent write-heavy workloads (not a concern for dogfood).
- **Harder:** Full-text search (SQLite FTS exists but not as ergonomic as Postgres).
- **New constraint:** `drizzle-kit push` is destructive — fine for dogfood, needs migration tooling before production.
- **Follow-up:** Architecture.md tech stack section references "PostgreSQL (scale)" — this remains the scale-out path. SQLite is the dogfood choice. Turso/libSQL is the deferred cloud-sync option (see roadmap, Deferred Infrastructure).
