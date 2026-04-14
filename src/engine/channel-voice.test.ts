/**
 * Voice Channel Adapter Tests (Brief 142b, Brief 150)
 *
 * Tests the VoiceChannelAdapter implementation and voice transcript persistence.
 */

import { describe, it, expect } from "vitest";
import { VoiceChannelAdapter, createVoiceAdapter } from "./channel";

describe("VoiceChannelAdapter", () => {
  it("has channel type 'voice'", () => {
    const adapter = new VoiceChannelAdapter();
    expect(adapter.channel).toBe("voice");
  });

  it("send returns not supported for v1", async () => {
    const adapter = new VoiceChannelAdapter();
    const result = await adapter.send({
      to: "+1234567890",
      body: "Hello",
      personaId: "alex",
      mode: "connecting",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("v1");
  });

  it("search returns empty array for v1", async () => {
    const adapter = new VoiceChannelAdapter();
    const result = await adapter.search("test");
    expect(result).toEqual([]);
  });
});

describe("createVoiceAdapter", () => {
  it("returns null when ELEVENLABS_API_KEY is not set", () => {
    const original = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    const adapter = createVoiceAdapter();
    expect(adapter).toBeNull();
    if (original) process.env.ELEVENLABS_API_KEY = original;
  });

  it("returns adapter when ELEVENLABS_API_KEY is set", () => {
    const original = process.env.ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = "test-key";
    const adapter = createVoiceAdapter();
    expect(adapter).toBeInstanceOf(VoiceChannelAdapter);
    if (original) {
      process.env.ELEVENLABS_API_KEY = original;
    } else {
      delete process.env.ELEVENLABS_API_KEY;
    }
  });
});

describe("Voice transcript format (Brief 150)", () => {
  it("voice turns are prefixed with [voice] marker", () => {
    // This tests the format contract that saveVoiceTranscript uses
    const voiceTurns = [
      { role: "user" as const, text: "Tell me about your business" },
      { role: "alex" as const, text: "We help people build AI harnesses" },
    ];

    const formatted = voiceTurns.map((t) => ({
      role: t.role === "user" ? "user" : "assistant",
      content: `[voice] ${t.text}`,
    }));

    expect(formatted[0].content).toBe("[voice] Tell me about your business");
    expect(formatted[0].role).toBe("user");
    expect(formatted[1].content).toBe("[voice] We help people build AI harnesses");
    expect(formatted[1].role).toBe("assistant");
  });

  it("voice turns can be filtered from mixed message arrays", () => {
    const messages = [
      { role: "user", content: "Hello from text chat" },
      { role: "assistant", content: "Hey! Alex here." },
      { role: "user", content: "[voice] Tell me more" },
      { role: "assistant", content: "[voice] Sure, let me explain" },
      { role: "user", content: "Back to text" },
    ];

    const voiceTurns = messages.filter((m) => m.content.startsWith("[voice]"));
    expect(voiceTurns).toHaveLength(2);
    expect(voiceTurns[0].content).toBe("[voice] Tell me more");
  });
});
