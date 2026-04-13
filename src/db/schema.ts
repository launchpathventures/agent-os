/**
 * Ditto — Database Schema (barrel re-export)
 *
 * All tables and types now live in domain-aligned modules under ./schema/:
 *
 *   engine.ts    — @ditto/core harness primitives (processes, runs, trust, memory, etc.)
 *   network.ts   — Centralized Ditto Network Service (people, interactions, fleet)
 *   frontdoor.ts — Public-facing tables (chat sessions, verification, funnel)
 *   product.ts   — Workspace-level Ditto features (sessions, briefs, budgets, SLM)
 *
 * This file re-exports everything so existing imports continue to work unchanged.
 * The domain split mirrors the ADR-025 deployment topology.
 */

export * from "./schema/index.js";
