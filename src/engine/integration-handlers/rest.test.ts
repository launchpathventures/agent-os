/**
 * REST Protocol Handler Tests (Brief 025)
 *
 * Tests: GET requests, POST requests, auth header injection,
 * error handling, credential scrubbing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeRest, resolveRestAuth } from "./rest";
import type { RestInterface } from "../integration-registry";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
  vi.clearAllMocks();
  // Clean up env vars
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_TOKEN;
  delete process.env.TEST_API_KEY;
});

describe("rest handler", () => {
  const slackInterface: RestInterface = {
    base_url: "https://slack.com/api",
    auth: "bearer_token",
    headers: { "Content-Type": "application/json; charset=utf-8" },
  };

  describe("resolveRestAuth", () => {
    it("resolves bearer_token auth from env vars", () => {
      process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
      const { headers, authValues } = resolveRestAuth("slack", slackInterface);

      expect(headers["Authorization"]).toBe("Bearer xoxb-test-token");
      expect(authValues["SLACK_BOT_TOKEN"]).toBe("xoxb-test-token");
    });

    it("falls back to SERVICE_TOKEN if BOT_TOKEN not set", () => {
      process.env.SLACK_TOKEN = "xoxb-fallback";
      const { headers } = resolveRestAuth("slack", slackInterface);

      expect(headers["Authorization"]).toBe("Bearer xoxb-fallback");
    });

    it("includes static headers from interface definition", () => {
      const { headers } = resolveRestAuth("slack", slackInterface);

      expect(headers["Content-Type"]).toBe("application/json; charset=utf-8");
    });

    it("resolves api_key auth type", () => {
      process.env.TEST_API_KEY = "sk-test-123";
      const iface: RestInterface = {
        base_url: "https://api.example.com",
        auth: "api_key",
      };
      const { headers } = resolveRestAuth("test", iface);

      expect(headers["Authorization"]).toBe("Bearer sk-test-123");
    });
  });

  describe("executeRest", () => {
    it("makes a GET request with query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, messages: [] }),
      });

      const { result, logs } = await executeRest({
        service: "slack",
        restInterface: slackInterface,
        method: "GET",
        endpoint: "/search.messages",
        query: { query: "test", count: "5" },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/search.messages?");
      expect(calledUrl).toContain("query=test");
      expect(calledUrl).toContain("count=5");
      expect(result).toEqual({ ok: true, messages: [] });
      expect(logs.some((l: string) => l.includes("OK"))).toBe(true);
    });

    it("makes a POST request with JSON body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, ts: "123" }),
      });

      const { result } = await executeRest({
        service: "slack",
        restInterface: slackInterface,
        method: "POST",
        endpoint: "/chat.postMessage",
        body: { channel: "C123", text: "hello" },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const opts = mockFetch.mock.calls[0][1] as RequestInit;
      expect(opts.method).toBe("POST");
      expect(opts.body).toBe(JSON.stringify({ channel: "C123", text: "hello" }));
      expect(result).toEqual({ ok: true, ts: "123" });
    });

    it("handles HTTP error responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const { result, logs } = await executeRest({
        service: "slack",
        restInterface: slackInterface,
        method: "GET",
        endpoint: "/test",
      });

      expect(result).toEqual({ error: "HTTP 401", body: "Unauthorized" });
      expect(logs.some((l: string) => l.includes("401"))).toBe(true);
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result, logs } = await executeRest({
        service: "slack",
        restInterface: slackInterface,
        method: "GET",
        endpoint: "/test",
      });

      expect(result).toEqual({ error: "Network error" });
      expect(logs.some((l: string) => l.includes("FAILED"))).toBe(true);
    });

    it("scrubs credentials from response text", async () => {
      process.env.SLACK_BOT_TOKEN = "xoxb-secret-token-123";
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request with token xoxb-secret-token-123 in error",
      });

      const { result } = await executeRest({
        service: "slack",
        restInterface: slackInterface,
        method: "GET",
        endpoint: "/test",
      });

      const body = (result as { body: string }).body;
      expect(body).not.toContain("xoxb-secret-token-123");
      expect(body).toContain("[REDACTED]");
    });

    it("returns raw text when response is not JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "plain text response",
      });

      const { result } = await executeRest({
        service: "slack",
        restInterface: slackInterface,
        method: "GET",
        endpoint: "/test",
      });

      expect(result).toBe("plain text response");
    });
  });
});
