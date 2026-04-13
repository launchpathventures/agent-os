---
id: "178"
title: "Voice as transport, harness as brain"
status: active
emerged: "2026-04-13"
context: "Brief 142b — ElevenLabs voice channel integration"
---

# Insight 178: Voice as transport, harness as brain

## Discovery

When building the voice channel, we initially tried to make the voice LLM (hosted on ElevenLabs) own the conversation intelligence — following our process, calling tools, managing stage gates. This failed repeatedly: the fast LLM (GLM-4.5-Air) was unreliable at tool calling and couldn't follow complex process instructions.

The breakthrough: **separate the voice layer from the intelligence layer**. ElevenLabs owns speed (STT + fast LLM + TTS, ~600ms). Our harness owns intelligence (same pipeline as text chat). The two communicate via:

1. **Server tools** (ElevenLabs → harness): `fetch_url`, `update_learned` — called when the voice agent needs to do something
2. **sendContextualUpdate** (harness → ElevenLabs): SYSTEM INSTRUCTION messages pushed to the voice agent telling it what to ask next
3. **Parallel evaluation**: after every voice turn, the harness runs `evaluateVoiceConversation()` using the SAME text chat pipeline (system prompt, tool schema, stage gates, learned extraction) and produces guidance

## Principle

Voice is a transport layer, not an intelligence layer. The harness runs the same process regardless of surface — text chat or voice. The voice LLM's job is to sound human. The harness's job is to be smart.

## Implications

- Any new surface (phone, WhatsApp, video) should follow this pattern: fast response layer + harness evaluation in parallel
- The voice agent's system prompt should be minimal (personality only) — process intelligence comes from the harness via contextual updates
- Don't rely on the voice LLM calling tools — push intelligence to it proactively
- The harness evaluation must save both user AND agent messages to the session so it sees the full conversation
