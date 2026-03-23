# Insight-068: Composition Means Use the Code, Not Just the Pattern

**Date:** 2026-03-23
**Trigger:** User correction during ADR-009 v2 design — questioned whether provenance citations mean "use as dependency" or "study and reimplement." Further refined: Ditto's dev process should mimic how real developers work with open source.
**Layers affected:** All layers, dev process
**Status:** active (revised — original version overcorrected toward npm dependencies)

## The Insight

"Composition over invention" has been interpreted as "study patterns from existing projects, then reimplement in our own code." This is too narrow — but the correction is NOT "default to npm install." The correction is: **be pragmatic about code reuse the way real developers are.**

Real developers working with open source are pragmatic:

| Situation | What real devs do | Ditto equivalent |
|-----------|-------------------|------------------|
| Mature, battle-tested library with governance and stability guarantees | `npm install` | **Depend** — Drizzle, Zod, React, SQLite, Grammy |
| Useful code that solves a specific problem well | Grab the files, understand them, adapt them, own them | **Adopt** — take source files into Ditto's codebase, adapt to our needs, maintain ourselves |
| Architectural idea or design pattern | Study the approach, implement your own way | **Pattern** — learn from it, build differently |

The critical distinction: **adopt** (take the code) is different from **depend** (take the package). When you adopt code, you own it — you understand it, you maintain it, you evolve it for your needs. When you depend on a package, you're trusting someone else's maintenance, release cadence, and design decisions.

**When to depend (npm install):**
- Project has reached v1+ with stability guarantees
- Multiple maintainers, active governance
- Established community of dependents
- Clean, bounded API surface
- License compatible (Apache-2.0, MIT)

**When to adopt (grab the code):**
- The code is excellent but the project is immature (v0.x, single maintainer, Labs/experimental)
- You need significant adaptation that would fight the library's opinions
- The coupling surface is deep (proprietary formats, many integration points)
- You need to evolve the code in directions the upstream may not go

**When to pattern-only:**
- The implementation context is fundamentally different
- Only the conceptual idea transfers, not the code

The previous version of this insight defaulted to "depend." That was wrong. The default should be pragmatic assessment: **is this a mature library I can trust, or is this good code I should own?**

## json-render Specifically

json-render has excellent engineering: the catalog system, flat spec format, Zod-as-triple-duty-contract, and registry pattern are well-designed. But it's a 68-day-old, single-maintainer, v0.x Vercel Labs experiment with zero npm dependents and a proprietary spec format. Taking an npm dependency would be reckless.

The right move: **adopt the relevant source code** — specifically the catalog/schema system, the spec types, and the renderer pattern. Bring them into Ditto's codebase, adapt for process-scoped catalogs and trust-governed richness, and own the evolution. Credit the provenance. Don't create a dependency chain.

## Implications

- Briefs and ADRs should state composition approach: depend, adopt, or pattern
- "Depend" is reserved for mature, governed libraries — not the default
- "Adopt" means taking source files, understanding them, and owning maintenance
- Research should evaluate both "what patterns exist" AND "is this code we can grab and adapt"
- The dev process should feel like how real developers work with open source — pragmatic, not ceremonial

## Where It Should Land

- `CLAUDE.md` principles section — update "Composition over invention" with the three pragmatic levels
- `docs/briefs/000-template.md` — Provenance table Level column updated (depend/adopt/pattern)
- ADR-009 v2 provenance entries for json-render should say "adopt" not "depend"
