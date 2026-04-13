/**
 * Tests for UnipileAdapter — social channel ghost mode (Brief 133).
 *
 * Tests: message formatting (no branding), platform routing,
 * rate limit enforcement, test mode suppression.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  UnipileAdapter,
  checkRateLimit,
  _resetRateLimits,
  type OutboundMessage,
  type SocialPlatform,
} from "./channel";

const mockSendMessage = vi.fn().mockResolvedValue({
  object: "MessageSent",
  message_id: "msg-123",
});
const mockStartNewChat = vi.fn().mockResolvedValue({
  object: "ChatStarted",
  chat_id: "chat-456",
  message_id: "msg-789",
});

// Mock unipile-node-sdk
vi.mock("unipile-node-sdk", () => {
  class MockUnipileClient {
    messaging = {
      sendMessage: mockSendMessage,
      startNewChat: mockStartNewChat,
    };
    account = {
      getAll: vi.fn().mockResolvedValue({ items: [] }),
    };
    constructor(_dsn: string, _token: string) {}
  }

  return {
    UnipileClient: MockUnipileClient,
  };
});

function createAdapter(platform: SocialPlatform = "linkedin"): UnipileAdapter {
  return new UnipileAdapter(
    "https://api.test.unipile.com:13111",
    "test-api-key",
    "test-account-id",
    platform,
  );
}

function ghostMessage(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return {
    to: "attendee-recipient-id",
    body: "Hey Sarah, great chatting yesterday. Let's grab coffee next week?",
    personaId: "alex",
    mode: "ghost",
    sendingIdentity: "ghost",
    platform: "linkedin",
    ...overrides,
  };
}

describe("UnipileAdapter", () => {
  beforeEach(() => {
    _resetRateLimits();
    delete process.env.DITTO_TEST_MODE;
    delete process.env.DITTO_TEST_SOCIAL_IDS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("send — new chat (first DM)", () => {
    it("starts a new chat with attendee ID when no inReplyToMessageId", async () => {
      const adapter = createAdapter();
      const msg = ghostMessage();
      const result = await adapter.send(msg);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-789");
      expect(result.threadId).toBe("chat-456");

      expect(mockStartNewChat).toHaveBeenCalledWith({
        account_id: "test-account-id",
        text: msg.body,
        attendees_ids: ["attendee-recipient-id"],
      });
    });

    it("sends to existing chat when inReplyToMessageId is set", async () => {
      const adapter = createAdapter();
      const msg = ghostMessage({ inReplyToMessageId: "existing-chat-id" });
      const result = await adapter.send(msg);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-123");
      expect(result.threadId).toBe("existing-chat-id");

      expect(mockSendMessage).toHaveBeenCalledWith({
        chat_id: "existing-chat-id",
        text: msg.body,
      });
    });
  });

  describe("ghost mode — no branding", () => {
    it("sends body as-is when sendingIdentity is ghost (no persona sign-off)", async () => {
      const adapter = createAdapter();
      const rawBody = "Thanks for the intro, looking forward to connecting.";
      const msg = ghostMessage({ body: rawBody });

      await adapter.send(msg);

      expect(mockStartNewChat).toHaveBeenCalledWith(
        expect.objectContaining({ text: rawBody }),
      );
    });

    it("adds branding when sendingIdentity is NOT ghost", async () => {
      const adapter = createAdapter();
      const msg = ghostMessage({
        sendingIdentity: "agent-of-user",
        mode: "connecting",
      });

      await adapter.send(msg);

      const sentText = mockStartNewChat.mock.calls[0][0].text;
      // formatEmailBody adds persona sign-off for non-ghost
      expect(sentText).toContain("Alex\nDitto");
    });
  });

  describe("rate limiting", () => {
    it("allows sends under the daily limit", () => {
      const { allowed, remaining } = checkRateLimit("acc-1", "linkedin");
      expect(allowed).toBe(true);
      expect(remaining).toBe(50);
    });

    it("blocks sends when daily limit is reached", async () => {
      const adapter = createAdapter();
      const msg = ghostMessage();

      // Send 50 messages to hit the limit
      for (let i = 0; i < 50; i++) {
        await adapter.send(msg);
      }

      // 51st should fail
      const result = await adapter.send(msg);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Daily linkedin message limit reached");
    });

    it("resets at midnight (simulated via _resetRateLimits)", async () => {
      const adapter = createAdapter();
      const msg = ghostMessage();

      for (let i = 0; i < 50; i++) {
        await adapter.send(msg);
      }

      _resetRateLimits();

      const result = await adapter.send(msg);
      expect(result.success).toBe(true);
    });

    it("tracks limits per platform independently", () => {
      // Exhaust LinkedIn doesn't affect WhatsApp
      _resetRateLimits();
      const linkedinCheck = checkRateLimit("acc-1", "linkedin");
      const whatsappCheck = checkRateLimit("acc-1", "whatsapp");
      expect(linkedinCheck.remaining).toBe(50);
      expect(whatsappCheck.remaining).toBe(200);
    });
  });

  describe("test mode suppression", () => {
    it("suppresses social sends in test mode when recipient not allowlisted", async () => {
      process.env.DITTO_TEST_MODE = "true";
      process.env.DITTO_TEST_SOCIAL_IDS = "allowed-id";

      const adapter = createAdapter();
      const msg = ghostMessage({ to: "not-allowed-id" });
      const result = await adapter.send(msg);

      expect(result.success).toBe(true);
      expect(result.messageId).toContain("test-suppressed-social");

      expect(mockStartNewChat).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("allows social sends to allowlisted IDs in test mode", async () => {
      process.env.DITTO_TEST_MODE = "true";
      process.env.DITTO_TEST_SOCIAL_IDS = "attendee-recipient-id";

      const adapter = createAdapter();
      const msg = ghostMessage();
      const result = await adapter.send(msg);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-789");
    });
  });

  describe("error handling", () => {
    it("returns error result when Unipile API throws", async () => {
      mockStartNewChat.mockRejectedValueOnce(new Error("Unipile API rate limited"));

      const adapter = createAdapter();
      const msg = ghostMessage();
      const result = await adapter.send(msg);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unipile API rate limited");
    });
  });

  describe("search and reply stubs", () => {
    it("search returns empty array (v1 stub)", async () => {
      const adapter = createAdapter();
      const results = await adapter.search("anything");
      expect(results).toEqual([]);
    });

    it("reply throws not-implemented", async () => {
      const adapter = createAdapter();
      await expect(adapter.reply!("msg-1", "body", "alex")).rejects.toThrow(
        "not implemented",
      );
    });
  });

  describe("channel property", () => {
    it("reports channel as social", () => {
      const adapter = createAdapter();
      expect(adapter.channel).toBe("social");
    });
  });
});
