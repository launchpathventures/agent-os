# Ditto

**AI that gets better every time you work with it.**

---

Every AI tool you've tried has the same problem: it doesn't stick.

You correct the quote. Tomorrow, same mistake. You teach it your brand voice. Next week, it's forgotten. You set up an automation. It breaks the moment reality doesn't match the flowchart.

**The problem isn't AI capability. It's that AI has no process, no memory, and no accountability.** It reinvents its approach every time. Nobody's built the layer that makes AI actually reliable.

Ditto is that layer.

---

## What's Actually Different

Not features. Fundamentals.

**Nothing else earns trust.** Every AI tool is all-or-nothing: you supervise everything, or you hope for the best. Ditto starts supervised — you review every output. As the system proves reliable (tracked approval rates, correction rates, consistency), it suggests reducing oversight. You decide. Different processes earn trust independently. Quality drops? Oversight increases automatically. No other system does this.

**Nothing else learns from what you naturally do.** You won't fill out feedback forms. Nobody does. So Ditto learns from your actual work. Edit an output — that's a lesson (the system diffs and stores the correction). Approve — that's confirmation. Reject — that's a correction. After three similar edits: "You always add the sustainability angle. Make this permanent?" One tap. The process improves without you teaching it explicitly. No other system captures feedback this way.

**Nothing else thinks about how to think.** This is the biggest gap in AI today. Every agent framework gives agents tasks and tools. None gives agents the right *mindset* for each task, monitors whether their approach is working, or adapts when it isn't. Ditto does: research gets curiosity, review gets rigour, analysis gets precision. Agents have access to proven reasoning tools and the judgment to choose which to apply. When something isn't working, the system notices — and an honest "I'm not sure about this one" earns *more* trust, not less. No other system has a cognitive architecture for agents.

**Nothing else makes AI work feel like working with a great team.** The morning brief summarises what happened overnight. The review queue shows only what needs your judgment. Autonomous processes run silently — no notifications when things are fine. One queue for everything, from your phone or your desk. The system stays quiet when things are working and tells you why when they're not.

## What This Actually Feels Like

**Week 1:** You describe what's eating your time — quoting, content review, invoice follow-up. The system helps you shape it into a process. You check every output. You correct a few things. The system learns.

**Week 3:** Corrections are rare. The system shows you the data: "Last 20 outputs — 18 approved clean. Want to reduce oversight?" You accept. Now you review samples, not everything.

**Month 2:** You add a second process. Then a third. One morning brief covers all of them. You're making decisions, not doing operations.

**Month 3:** Most processes run on their own. You handle exceptions. The system proposes improvements backed by evidence. You decide. Your evenings are yours again.

This isn't a pitch. It's a working engine — 5 build phases complete, 66 tests passing, 11 processes running, end-to-end work evolution verified.

## Who This Is For

People who own outcomes — not technology.

- The trades business owner who can't run the business AND do the work
- The ecommerce director who wants to be strategic but spends all day reacting
- The team lead who spends half their day reviewing things they've already taught people how to do
- The technologist who can see 20 things that should be automated but can't build 20 solutions

You don't need to be a developer. You don't need to draw workflow diagrams. You don't need to write prompts. You just need to know what good looks like — the system helps you build everything else.

---

## Building AI Agents? Read This.

The agent framework space has solved execution. It hasn't solved governance, trust, learning, or cognitive quality.

Everyone can build an agent that runs. Nobody has built an agent that earns trust, learns from corrections, and gets smarter about how it thinks. That's the gap. Here's what your agents are missing:

**A harness.** Not just prompts and tools — composable review patterns where agents check each other's work, trust tiers earned through track record, feedback loops that capture learning from natural human actions, and memory that persists across runs. Your agents run inside this. It makes them production-ready.

**A cognitive architecture.** The right mindset per task. Metacognitive monitoring ("is this approach working?"). Adaptive scaffolding that gives capable models freedom and supports weaker ones. Space for intuition — noticing what wasn't asked for. No agent framework has this. ([ADR-014](docs/adrs/014-agent-cognitive-architecture.md))

**Executive function in the orchestrator.** Not "decompose goal → track tasks." An orchestrator that monitors whether the approach is converging on the intention, senses when to rethink, stops unproductive patterns, and surfaces structured learning from failures. The difference between a task tracker and a manager.

**Durable process.** Defined once, refined through corrections, executed consistently. Industry standards (APQC) as starting points. Templates with governance declarations. No reinventing the approach every run.

If you're building on OpenClaw, CrewAI, LangGraph, or AutoGen — Ditto isn't a replacement. It's the governed, trust-earning, learning harness that sits around your agents. Bring your own AI runtime. Ditto provides everything else.

**Go deeper:**
- [Agent Integration Guide](docs/agent-integration-guide.md) — **8 patterns your AI agents can adopt today.** Designed for machine reading. Drop it into your agent's context.
- [Technical Overview](docs/TECHNICAL.md) — five engines, six-layer architecture, composition strategy
- [Architecture Specification](docs/architecture.md) — the full design with provenance for every pattern
- [ADR-014: Agent Cognitive Architecture](docs/adrs/014-agent-cognitive-architecture.md) — how agents think, not just execute
- [Roadmap](docs/roadmap.md) — what's built, what's next, where to contribute

## Learn More

- [Vision](docs/vision.md) — why this exists
- [Who We're Building For](docs/personas.md) — real stories, real problems
- [Current State](docs/state.md) — what's working right now

## License

AGPL-3.0
