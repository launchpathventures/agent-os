/**
 * Ditto — Unified Schema Index
 *
 * Re-exports all tables and types from the four domain schemas.
 * This is the single import point for application code:
 *
 *   import { processes, people, chatSessions } from "../db/schema";
 *
 * The domain split (engine / network / frontdoor / product) mirrors
 * the ADR-025 deployment topology:
 *
 *   engine.ts    — @ditto/core harness primitives (every workspace)
 *   network.ts   — Centralized Ditto Network Service (ADR-025 §2)
 *   frontdoor.ts — Public-facing anonymous visitor tables
 *   product.ts   — Workspace-level Ditto features (not engine)
 */

export * from "./engine.js";
export * from "./network.js";
export * from "./frontdoor.js";
export * from "./product.js";
