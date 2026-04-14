# Insight-185: Identity-Aware Tools over Channel Hardcoding

**Date:** 2026-04-14
**Trigger:** Discovering that process templates referenced `google-workspace.send_message` for LAND steps, creating a hard dependency on an integration nobody had connected. Meanwhile `crm.send_email` worked everywhere but ignored sending identity.
**Layers affected:** L3 (Harness — tool execution), L2 (Agent — tool availability), L4 (Awareness — identity resolution)
**Status:** active

## The Insight

Process templates should declare **what** they need to do (send an email), not **which channel** to use (AgentMail vs Gmail). The delivery channel is a runtime decision based on the user's connected integrations and the step's sending identity — not a design-time decision baked into YAML.

When a template hardcodes `google-workspace.send_message`, it creates a silent failure: the tool resolver can't find the integration, the step executes without the tool, and the AI agent can't send the email. No error. No fallback. Just a step that does nothing useful.

The fix is not to add fallback logic in templates (conditional routing in YAML is fragile). The fix is to make the existing tool (`crm.send_email`) identity-aware: the tool always exists, the tool always works, and the harness resolves the actual delivery channel based on what's available.

**The principle:** Tools should express intent. The harness resolves mechanism.

## Implications

1. **Never reference integration-specific tools in templates for core capabilities.** `crm.send_email` is the canonical "send email" tool. It routes internally.
2. **Integration availability is a runtime concern, not a template concern.** Templates declare tools that always exist (built-ins). Integration-specific tools are for integration-specific capabilities (inbox triage via Gmail, calendar reads, etc.).
3. **This pattern extends beyond email.** When social DMs, voice, or SMS gain identity routing, the same principle applies: `crm.send_message` resolves to the right channel at runtime.
4. **The identity-router handler (core) sets intent. The tool resolver (product) resolves mechanism.** Clean separation: core says "this step sends as agent-of-user", product says "agent-of-user on this user means Gmail API with these credentials."

## Where It Should Land

- `docs/architecture.md` — document in Layer 3 under tool resolution: "built-in tools express intent, harness resolves delivery channel"
- Process template guidelines — add constraint: "LAND steps must use `crm.send_email`, never integration-specific send tools"
- `src/engine/tool-resolver.ts` — the identity-aware resolution is the implementation of this principle
