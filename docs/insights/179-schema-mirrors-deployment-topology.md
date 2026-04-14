# Insight-179: Schema Organization Should Mirror Deployment Topology

**Date:** 2026-04-13
**Trigger:** DB schema refactor — splitting 44-table monolithic schema into domain modules
**Layers affected:** L1 Process, Cross-cutting (Storage)
**Status:** active

## The Insight

When organizing database schema files, the split should mirror the **deployment topology** (ADR-025: Network vs Workspace), not the **architectural layers** (L1-L6). Layers are conceptual — they help you reason about the system. Deployment targets are physical — they determine which tables go where when you split services.

The previous approach had `packages/core/src/db/schema.ts` (engine tables) and `src/db/schema.ts` (everything else). This split was by abstraction level, not by where the tables physically live. The result: when it came time to think about separating Network from Workspace (ADR-025), the schema gave no guidance on which tables belonged where.

The new split — `engine.ts` / `network.ts` / `frontdoor.ts` / `product.ts` — directly answers "which tables go with which deployment target?" When the Network Service becomes its own service, you take `network.ts` + `frontdoor.ts` and you're done.

## Implications

- Schema files should be named for their deployment destination, not their architectural layer
- The same principle applies to other file organization decisions: group by deployment boundary, not by concept
- This also made the `@ditto/core` boundary cleaner: core = engine tables only. Everything else is a deployment concern.

## Where It Should Land

ADR-025 should reference this schema organization pattern. CLAUDE.md "Engine Core" section should document the four-file schema split.
