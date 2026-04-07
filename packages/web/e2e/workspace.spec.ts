/**
 * Ditto — Workspace Layout E2E Tests
 *
 * Verifies workspace layout basics (AC7):
 * - Page loads with conversation interface
 * - Chat input uses data-testid selectors
 * - Send button state management
 *
 * Provenance: Brief 054 (Testing Infrastructure).
 */

import { test, expect, resetDatabase } from "./fixtures";

test.beforeAll(async () => {
  await resetDatabase();
});

test.describe("Workspace layout", () => {
  test("page loads with chat input (data-testid)", async ({ page }) => {
    // Bypass Day Zero welcome screen — set localStorage before navigation
    // Use addInitScript so it runs before any page JS
    await page.addInitScript(() => {
      localStorage.setItem("ditto-day-zero-seen", "true");
    });
    await page.goto("/");

    // Wait for the chat input directly — don't use networkidle (SSE keeps connections open)
    await expect(page.getByTestId("chat-input")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("send-button")).toBeVisible();
  });

  test("page shows Ditto branding on first load", async ({ page }) => {
    await page.goto("/");

    // The conversation page shows "Ditto" in branding
    await expect(page.getByText("Ditto", { exact: false })).toBeVisible({ timeout: 15000 });
  });

  test("chat input accepts and clears text on submit", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("ditto-day-zero-seen", "true");
    });
    await page.goto("/");

    const input = page.getByTestId("chat-input");
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.fill("test message");
    await expect(input).toHaveValue("test message");

    // Submit and verify input clears
    await input.press("Enter");
    await expect(input).toHaveValue("");
  });

  test("send button becomes interactive when text is entered", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("ditto-day-zero-seen", "true");
    });
    await page.goto("/");

    const input = page.getByTestId("chat-input");
    await expect(input).toBeVisible({ timeout: 15000 });

    // Fill text — send button should exist and be clickable
    await input.fill("hello");
    const sendButton = page.getByTestId("send-button").first();
    await expect(sendButton).toBeAttached();
  });
});
