# Agent OS — Vision

## The Problem

Every agent platform today forces business processes into chat. Chat is a conversation metaphor — freeform, ephemeral, exploratory. Business processes are a factory metaphor — structured, repeatable, measurable. The mismatch creates systems that can't be trusted, can't learn, and can't scale.

Current agent frameworks are binary: either a human checks everything (expensive, doesn't scale) or the agent runs autonomously (risky, no governance). There's no middle ground. No way to earn trust progressively. No way for the system to learn from corrections without explicit forms and feedback loops that no one fills out.

## The Insight

Agent OS is not an agent framework. It is a **harness creator**.

Agents are commodities — Claude, GPT, scripts, APIs, whatever comes next. What matters is the **harness** within which they operate: who checks whom, what trust level governs execution, what quality gates apply, and how the system learns from every human decision.

The harness has two dimensions:
- **Evolving** — it learns from feedback, corrections, and trust data. The harness today is different from the harness next month.
- **Orchestrating** — it coordinates agents, determines review patterns, manages parallel execution, and enforces governance.

The **process** is not a workflow. It is a **governance declaration**: what inputs are acceptable, what value looks like, what quality gates apply, what trust level governs execution, and what outputs matter.

Agents are pluggable. Processes are durable. The harness is the product.

## The Principles

**Process is the primitive.** The atomic unit isn't a task, an agent, or a workflow. It's a process: inputs → transformation → outputs, with known sources and known destinations. An agent is just the thing that executes a process.

**Composition over invention.** Agent OS composes proven open-source projects rather than building from scratch. The first question — for the platform and for every agent within it — is: "what can we build FROM?" not "what can we build?" The unique value is in the harness, trust, governance, and learning layers.

**Progressive trust, earned not configured.** Trust starts conservative (supervised — human reviews everything) and is earned through track record. The system tracks approval rates, correction rates, and review cycles. When thresholds are met, it suggests upgrades. It never auto-upgrades. Trust automatically downgrades when quality degrades.

**Implicit feedback.** Humans won't fill out forms. So edits ARE feedback. Rejections ARE feedback. The system captures structurally from the human's natural workflow. Every correction teaches the system without anyone having to teach it explicitly.

**The platform never auto-fixes.** It surfaces, diagnoses, and suggests. Self-improvement is proposed, never applied. The human stays in control.

**Everyone will be a manager and delegator.** In the future, every knowledge worker manages and delegates to agents. The interface must be usable by someone who has never managed people or processes. The design challenge is making management intuitive for non-managers.

## Where We're Going

Agent OS starts as a CLI-driven engine running a coding agent team — the dogfood. This first implementation proves: process definitions work, the harness enforces quality, trust is earned progressively, and feedback captures learning data.

From there:
- **Web dashboard** with 16 universal UI primitives that compose into any business view
- **Multi-domain** — the same platform serves marketing, finance, real estate, coding, or any domain
- **Explore → Operate transition** — conversations crystallise into process definitions
- **Governance agents** — cross-cutting compliance assurance across individuals, teams, organisations
- **Self-improving processes** — weekly scans propose improvements with evidence, humans decide

The vision is a universal platform where non-technical people define, monitor, review, and improve agent-operated processes — across any business domain. Working with agents should feel like working with the most reliable, self-reflective, learning-oriented teammates you've ever had.
