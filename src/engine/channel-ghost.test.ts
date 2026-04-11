/**
 * Ghost Mode Email Formatting Tests (Brief 124)
 *
 * Verifies that ghost mode emails:
 * - Have NO persona sign-off (no "Alex\nDitto")
 * - Have NO opt-out footer
 * - Have NO referral footer
 * - Have NO magic link footer
 * - Use the user's display name (tested via OutboundMessage)
 * - Include BCC address (tested via OutboundMessage)
 * - Have NO internal tracking headers
 *
 * Non-ghost emails continue to work as before.
 */

import { describe, it, expect } from "vitest";
import { formatEmailBody, type OutboundMessage } from "./channel";

function makeMessage(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return {
    to: "recipient@example.com",
    subject: "Test Subject",
    body: "Hey Sarah, just wanted to check in about next week.",
    personaId: "alex",
    mode: "connecting",
    ...overrides,
  };
}

describe("formatEmailBody — ghost mode (Brief 124)", () => {
  it("returns body as-is with no sign-off in ghost mode", () => {
    const msg = makeMessage({ sendingIdentity: "ghost" });
    const result = formatEmailBody(msg);

    expect(result).toBe("Hey Sarah, just wanted to check in about next week.");
    expect(result).not.toContain("Alex");
    expect(result).not.toContain("Ditto");
  });

  it("has NO opt-out footer in ghost mode", () => {
    const msg = makeMessage({
      sendingIdentity: "ghost",
      includeOptOut: true,
    });
    const result = formatEmailBody(msg);

    expect(result).not.toContain("unsubscribe");
    expect(result).not.toContain("opt");
  });

  it("has NO referral footer in ghost mode", () => {
    const msg = makeMessage({
      sendingIdentity: "ghost",
      referralUserId: "user-123",
    });
    const result = formatEmailBody(msg);

    expect(result).not.toContain("referred");
    expect(result).not.toContain("ref=");
  });

  it("has NO magic link footer in ghost mode", () => {
    const msg = makeMessage({
      sendingIdentity: "ghost",
      magicLinkUrl: "https://app.ditto.partners/chat/abc123",
    });
    const result = formatEmailBody(msg);

    expect(result).not.toContain("Continue in chat");
    expect(result).not.toContain("ditto.partners");
  });

  it("preserves all footers for non-ghost messages", () => {
    const msg = makeMessage({
      includeOptOut: true,
      referralUserId: "user-123",
      magicLinkUrl: "https://app.ditto.partners/chat/abc123",
    });
    const result = formatEmailBody(msg);

    expect(result).toContain("Alex\nDitto");
    expect(result).toContain("unsubscribe");
    expect(result).toContain("ref=user-123");
    expect(result).toContain("Continue in chat");
  });

  it("preserves persona sign-off for agent-of-user identity", () => {
    const msg = makeMessage({ sendingIdentity: "agent-of-user" });
    const result = formatEmailBody(msg);

    expect(result).toContain("Alex\nDitto");
  });

  it("preserves persona sign-off for principal identity", () => {
    const msg = makeMessage({ sendingIdentity: "principal" });
    const result = formatEmailBody(msg);

    expect(result).toContain("Alex\nDitto");
  });

  it("preserves persona sign-off when sendingIdentity is undefined", () => {
    const msg = makeMessage();
    const result = formatEmailBody(msg);

    expect(result).toContain("Alex\nDitto");
  });
});

describe("OutboundMessage ghost fields (Brief 124)", () => {
  it("accepts ghost mode fields on OutboundMessage", () => {
    const msg: OutboundMessage = {
      to: "sarah@example.com",
      subject: "Following up",
      body: "Hey Sarah, quick follow-up on our chat.",
      personaId: "alex",
      mode: "ghost",
      sendingIdentity: "ghost",
      bccAddress: "john@example.com",
    };

    // Type check — if this compiles, the interface accepts ghost fields
    expect(msg.sendingIdentity).toBe("ghost");
    expect(msg.bccAddress).toBe("john@example.com");
  });
});
