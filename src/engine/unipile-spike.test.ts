/**
 * Unipile Spike Validation Tests (Brief 133, AC1-3).
 *
 * These tests hit the real Unipile API to validate:
 * 1. SDK can connect and list accounts
 * 2. SDK can send a LinkedIn DM
 * 3. Delivery confirmation is received
 *
 * Requires UNIPILE_API_KEY and UNIPILE_DSN environment variables.
 * Skipped when credentials are not available.
 */

import { describe, it, expect } from "vitest";
import { UnipileClient } from "unipile-node-sdk";

const DSN = process.env.UNIPILE_DSN;
const API_KEY = process.env.UNIPILE_API_KEY;

const canRun = DSN && API_KEY;

describe.skipIf(!canRun)("Unipile Spike — Live API Validation", () => {
  let client: UnipileClient;

  function getClient(): UnipileClient {
    if (!client) {
      client = new UnipileClient(DSN!, API_KEY!);
    }
    return client;
  }

  it("AC1: can connect to Unipile and list accounts", async () => {
    const c = getClient();
    const accounts = await c.account.getAll();
    expect(accounts).toBeDefined();
    // The response should have account objects
    console.log("[spike] Connected accounts:", JSON.stringify(accounts, null, 2));
  });

  it("AC1b: at least one LinkedIn account is connected", async () => {
    const c = getClient();
    const accounts = await c.account.getAll();
    // Check that accounts response has data
    const accountsObj = accounts as { items?: unknown[] };
    const items = accountsObj.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    console.log("[spike] Account count:", items.length);
  });

  it("AC2: can start a new chat (send LinkedIn DM)", async () => {
    // This test requires a valid attendee_id for a LinkedIn connection.
    // Set UNIPILE_TEST_ATTENDEE_ID to a real attendee ID for testing.
    const attendeeId = process.env.UNIPILE_TEST_ATTENDEE_ID;
    const accountId = process.env.UNIPILE_TEST_ACCOUNT_ID;

    if (!attendeeId || !accountId) {
      console.log("[spike] Skipping DM send — set UNIPILE_TEST_ATTENDEE_ID and UNIPILE_TEST_ACCOUNT_ID");
      return;
    }

    const c = getClient();
    const result = await c.messaging.startNewChat({
      account_id: accountId,
      text: "Test message from Ditto spike — please ignore",
      attendees_ids: [attendeeId],
    });

    expect(result).toBeDefined();
    expect(result.object).toBe("ChatStarted");
    console.log("[spike] Chat started:", JSON.stringify(result, null, 2));
  });

  it("AC3: message ID is returned (delivery confirmation)", async () => {
    const attendeeId = process.env.UNIPILE_TEST_ATTENDEE_ID;
    const accountId = process.env.UNIPILE_TEST_ACCOUNT_ID;

    if (!attendeeId || !accountId) {
      console.log("[spike] Skipping delivery confirmation — set UNIPILE_TEST_ATTENDEE_ID and UNIPILE_TEST_ACCOUNT_ID");
      return;
    }

    const c = getClient();
    const result = await c.messaging.startNewChat({
      account_id: accountId,
      text: "Delivery confirmation test — please ignore",
      attendees_ids: [attendeeId],
    });

    // Unipile returns message_id on successful send
    expect(result.message_id).toBeDefined();
    console.log("[spike] Message ID (delivery confirmation):", result.message_id);
  });

  it("AC3b: can retrieve rate limit / account info", async () => {
    const accountId = process.env.UNIPILE_TEST_ACCOUNT_ID;

    if (!accountId) {
      console.log("[spike] Skipping account info — set UNIPILE_TEST_ACCOUNT_ID");
      return;
    }

    const c = getClient();
    const account = await c.account.getOne(accountId);
    expect(account).toBeDefined();
    console.log("[spike] Account info:", JSON.stringify(account, null, 2));
  });
});
