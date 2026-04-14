/**
 * Tests for publishPost() — social content publishing (Brief 141).
 *
 * Tests: LinkedIn via Unipile Posts API, X via API v2, thread posting
 * with sequential reply_to, partial thread failure, test mode suppression.
 *
 * Provenance: ADR-029, Brief 141 AC5-AC9, AC15
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { publishPost, XApiClient, getXApiConfig, type PublishResult } from "./channel";

// ── Mocks ────────────────────────────────────────────────────

const mockCreatePost = vi.fn().mockResolvedValue({
  id: "li-post-123",
  url: "https://www.linkedin.com/feed/update/li-post-123",
});

vi.mock("unipile-node-sdk", () => {
  class MockUnipileClient {
    messaging = {
      sendMessage: vi.fn(),
      startNewChat: vi.fn(),
    };
    users = {
      createPost: (...args: unknown[]) => mockCreatePost(...args),
    };
    constructor(_dsn: string, _token: string) {}
  }
  return { UnipileClient: MockUnipileClient };
});

// Mock global fetch for X API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Helpers ──────────────────────────────────────────────────

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, val] of Object.entries(vars)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

const UNIPILE_ENV = {
  UNIPILE_DSN: "https://api.test.unipile.com:13111",
  UNIPILE_API_KEY: "test-unipile-key",
};

const X_API_ENV = {
  X_API_KEY: "test-key",
  X_API_SECRET: "test-secret",
  X_ACCESS_TOKEN: "test-access",
  X_ACCESS_TOKEN_SECRET: "test-access-secret",
};

// ── Tests ────────────────────────────────────────────────────

describe("publishPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DITTO_TEST_MODE;
    delete process.env.UNIPILE_DSN;
    delete process.env.UNIPILE_API_KEY;
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_TOKEN_SECRET;
  });

  afterEach(() => {
    delete process.env.DITTO_TEST_MODE;
    delete process.env.UNIPILE_DSN;
    delete process.env.UNIPILE_API_KEY;
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_TOKEN_SECRET;
  });

  // ── AC9: Test mode suppression ───────────────────────────

  it("suppresses publishing in test mode", async () => {
    process.env.DITTO_TEST_MODE = "true";

    const result = await publishPost("linkedin", "Test post");

    expect(result.success).toBe(true);
    expect(result.postId).toContain("test-suppressed-publish");
    expect(result.platform).toBe("linkedin");
  });

  it("suppresses X publishing in test mode", async () => {
    process.env.DITTO_TEST_MODE = "true";

    const result = await publishPost("x", "Test tweet");

    expect(result.success).toBe(true);
    expect(result.postId).toContain("test-suppressed-publish");
    expect(result.platform).toBe("x");
  });

  // ── AC5: LinkedIn via Unipile Posts API ──────────────────

  it("rejects calls without stepRunId", async () => {
    setEnv(UNIPILE_ENV);

    const result = await publishPost("linkedin", "Post without context", {
      unipileAccountId: "acct-123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("stepRunId");
  });

  it("publishes to LinkedIn via Unipile createPost", async () => {
    setEnv(UNIPILE_ENV);

    const result = await publishPost("linkedin", "My LinkedIn post", {
      stepRunId: "step-run-1",
      unipileAccountId: "acct-123",
    });

    expect(result.success).toBe(true);
    expect(result.platform).toBe("linkedin");
    expect(result.postId).toBe("li-post-123");
    expect(result.postUrl).toContain("linkedin.com");
    expect(mockCreatePost).toHaveBeenCalledWith({
      account_id: "acct-123",
      text: "My LinkedIn post",
    });
  });

  it("includes attachments for LinkedIn", async () => {
    setEnv(UNIPILE_ENV);

    await publishPost("linkedin", "Post with image", {
      stepRunId: "step-run-1",
      unipileAccountId: "acct-123",
      attachments: ["https://example.com/image.png"],
    });

    expect(mockCreatePost).toHaveBeenCalledWith({
      account_id: "acct-123",
      text: "Post with image",
      attachments: ["https://example.com/image.png"],
    });
  });

  it("fails when Unipile not configured", async () => {
    const result = await publishPost("linkedin", "Post", {
      stepRunId: "step-run-1",
      unipileAccountId: "acct-123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unipile not configured");
  });

  it("fails when no Unipile account ID provided", async () => {
    setEnv(UNIPILE_ENV);

    const result = await publishPost("linkedin", "Post", {
      stepRunId: "step-run-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("account ID required");
  });

  // ── AC6: X via API v2 ───────────────────────────────────

  it("publishes to X via API v2", async () => {
    setEnv(X_API_ENV);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "tweet-456", text: "Hello X" } }),
    });

    const result = await publishPost("x", "Hello X", { stepRunId: "step-run-1" });

    expect(result.success).toBe(true);
    expect(result.platform).toBe("x");
    expect(result.postId).toBe("tweet-456");
    expect(result.postUrl).toContain("x.com/i/status/tweet-456");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.x.com/2/tweets",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ text: "Hello X" }),
      }),
    );
  });

  it("fails when X API not configured", async () => {
    const result = await publishPost("x", "Tweet", { stepRunId: "step-run-1" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("X API not configured");
  });

  // ── AC7: X threads ──────────────────────────────────────

  it("posts X threads sequentially with reply_to chaining", async () => {
    setEnv(X_API_ENV);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "t1", text: "Thread 1/3" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "t2", text: "Thread 2/3" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "t3", text: "Thread 3/3" } }),
      });

    const result = await publishPost("x", "Thread 1/3", {
      stepRunId: "step-run-1",
      threadTweets: ["Thread 1/3", "Thread 2/3", "Thread 3/3"],
    });

    expect(result.success).toBe(true);
    expect(result.threadResults).toHaveLength(3);
    expect(result.postId).toBe("t1"); // Head of thread

    // Verify chaining: second tweet replies to first, third to second
    const calls = mockFetch.mock.calls;
    const body1 = JSON.parse(calls[0][1].body);
    expect(body1.reply).toBeUndefined(); // First tweet has no reply

    const body2 = JSON.parse(calls[1][1].body);
    expect(body2.reply.in_reply_to_tweet_id).toBe("t1");

    const body3 = JSON.parse(calls[2][1].body);
    expect(body3.reply.in_reply_to_tweet_id).toBe("t2");
  });

  // ── AC8: Partial thread failure ─────────────────────────

  it("records partial success on thread failure", async () => {
    setEnv(X_API_ENV);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "t1", text: "1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "t2", text: "2" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "t3", text: "3" } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

    const result = await publishPost("x", "Thread", {
      stepRunId: "step-run-1",
      threadTweets: ["1", "2", "3", "4", "5", "6"],
    });

    // Tweets 1-3 succeeded, tweet 4 failed
    expect(result.success).toBe(false);
    expect(result.threadResults).toHaveLength(3);
    expect(result.threadResults![0].postId).toBe("t1");
    expect(result.threadResults![2].postId).toBe("t3");
    expect(result.error).toContain("tweet 4/6");
  });
});

// ── XApiClient unit tests ──────────────────────────────────

describe("XApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a single tweet", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "tweet-1", text: "hello" } }),
    });

    const client = new XApiClient({
      apiKey: "k",
      apiSecret: "s",
      accessToken: "at",
      accessTokenSecret: "ats",
    });

    const result = await client.postTweet("hello");

    expect(result.tweetId).toBe("tweet-1");
    expect(result.tweetUrl).toContain("tweet-1");
  });

  it("includes reply_to for reply tweets", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "reply-1", text: "reply" } }),
    });

    const client = new XApiClient({
      apiKey: "k",
      apiSecret: "s",
      accessToken: "at",
      accessTokenSecret: "ats",
    });

    await client.postTweet("reply", "parent-tweet-id");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply.in_reply_to_tweet_id).toBe("parent-tweet-id");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const client = new XApiClient({
      apiKey: "k",
      apiSecret: "s",
      accessToken: "at",
      accessTokenSecret: "ats",
    });

    await expect(client.postTweet("bad")).rejects.toThrow("X API error 403");
  });
});

// ── getXApiConfig ──────────────────────────────────────────

describe("getXApiConfig", () => {
  afterEach(() => {
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_TOKEN_SECRET;
  });

  it("returns config when all env vars are set (AC13)", () => {
    setEnv(X_API_ENV);

    const config = getXApiConfig();
    expect(config).toEqual({
      apiKey: "test-key",
      apiSecret: "test-secret",
      accessToken: "test-access",
      accessTokenSecret: "test-access-secret",
    });
  });

  it("returns null when any env var is missing", () => {
    process.env.X_API_KEY = "key";
    // Missing the rest

    expect(getXApiConfig()).toBeNull();
  });
});
