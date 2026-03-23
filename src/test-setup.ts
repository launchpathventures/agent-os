/**
 * Vitest global setup — mocks external API clients to prevent
 * import-time failures without API keys.
 *
 * This mocks the LLM SDKs only — NOT the database.
 * Tests use real SQLite via better-sqlite3.
 */

import { vi } from "vitest";

// Mock @anthropic-ai/sdk to prevent import-time failures
// when ANTHROPIC_API_KEY is not set.
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "mock response" }],
          usage: { input_tokens: 0, output_tokens: 0 },
          stop_reason: "end_turn",
        }),
      };
    },
  };
});

// Mock openai SDK to prevent import-time failures
// when OPENAI_API_KEY is not set.
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: { content: "mock response", tool_calls: null },
              finish_reason: "stop",
            }],
            usage: { prompt_tokens: 0, completion_tokens: 0 },
          }),
        },
      };
    },
  };
});
