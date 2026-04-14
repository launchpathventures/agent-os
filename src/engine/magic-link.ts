/**
 * Ditto — Magic Link Authentication (Brief 123)
 *
 * Passwordless auth for /chat. Users click a magic link in any Alex email
 * and land in their persistent chat session. Single-use, 24h expiry,
 * rate-limited to 5 per email per hour.
 *
 * Provenance: Slack magic link pattern (pattern level), custom implementation.
 */

import { randomBytes } from "crypto";
import { db, schema } from "../db";
import { eq, and, gt, sql } from "drizzle-orm";

const MAGIC_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_LINKS_PER_EMAIL_PER_HOUR = 5;

/**
 * Generate a cryptographically random 32-character token.
 * Uses base64url encoding of 24 random bytes = 32 chars.
 */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface MagicLinkResult {
  token: string;
  url: string;
}

/**
 * Create a magic link for the given email and session.
 * Returns the token and full URL, or null if rate limited.
 */
export async function createMagicLink(
  email: string,
  sessionId: string,
): Promise<MagicLinkResult | null> {
  // Rate limit: max 5 per email per hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentLinks = await db
    .select({ id: schema.magicLinks.id })
    .from(schema.magicLinks)
    .where(
      and(
        eq(schema.magicLinks.email, email.toLowerCase()),
        gt(schema.magicLinks.createdAt, new Date(oneHourAgo)),
      ),
    );

  if (recentLinks.length >= MAX_LINKS_PER_EMAIL_PER_HOUR) {
    return null;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

  await db.insert(schema.magicLinks).values({
    email: email.toLowerCase(),
    token,
    sessionId,
    expiresAt,
  });

  const baseUrl = process.env.NETWORK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const url = `${baseUrl}/chat/auth?token=${token}`;

  return { token, url };
}

export interface ValidMagicLink {
  email: string;
  sessionId: string;
}

/**
 * Validate a magic link token. Returns email + sessionId if valid,
 * null if expired, used, or not found.
 */
export async function validateMagicLink(
  token: string,
): Promise<ValidMagicLink | null> {
  const [link] = await db
    .select()
    .from(schema.magicLinks)
    .where(eq(schema.magicLinks.token, token));

  if (!link) return null;
  if (link.usedAt) return null;
  if (link.expiresAt.getTime() < Date.now()) return null;

  return {
    email: link.email,
    sessionId: link.sessionId,
  };
}

/**
 * Consume a magic link (single-use). Atomically marks it as used so
 * concurrent requests cannot both succeed. Returns the link data if
 * successfully consumed, null if already used/expired/not found.
 */
export async function consumeMagicLink(
  token: string,
): Promise<ValidMagicLink | null> {
  // Atomic: UPDATE only if unused AND not expired, then check affected rows
  const now = Date.now();
  const result = await db
    .update(schema.magicLinks)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.magicLinks.token, token),
        sql`${schema.magicLinks.usedAt} IS NULL`,
        gt(schema.magicLinks.expiresAt, new Date(now)),
      ),
    )
    .returning({ email: schema.magicLinks.email, sessionId: schema.magicLinks.sessionId });

  if (result.length === 0) return null;

  return { email: result[0].email, sessionId: result[0].sessionId };
}

/**
 * Create a workspace login magic link (Brief 143).
 * Uses a "workspace:" prefixed session ID (not tied to chat sessions).
 * Returns token and full URL, or null if rate limited.
 *
 * Brief 148: Persists frontdoor learned context as person-scoped memories
 * before generating the link — one write per transition.
 */
export async function createWorkspaceMagicLink(
  email: string,
): Promise<MagicLinkResult | null> {
  // Brief 148: Persist frontdoor learned context before generating link
  try {
    const [recentSession] = await db
      .select({ sessionId: schema.chatSessions.sessionId })
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.authenticatedEmail, email.toLowerCase()))
      .orderBy(sql`${schema.chatSessions.updatedAt} DESC`)
      .limit(1);

    if (recentSession) {
      const { persistLearnedContext } = await import("./memory-bridge");
      await persistLearnedContext(recentSession.sessionId);
    }
  } catch (err) {
    console.warn(`[magic-link] Failed to persist learned context for ${email}:`, err);
    // Non-fatal — magic link generation must not be blocked
  }

  // Rate limit: max 5 per email per hour (same as chat magic links)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentLinks = await db
    .select({ id: schema.magicLinks.id })
    .from(schema.magicLinks)
    .where(
      and(
        eq(schema.magicLinks.email, email.toLowerCase()),
        gt(schema.magicLinks.createdAt, new Date(oneHourAgo)),
      ),
    );

  if (recentLinks.length >= MAX_LINKS_PER_EMAIL_PER_HOUR) {
    return null;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

  // Use "workspace:" prefix to distinguish from chat session IDs
  const sessionId = `workspace:${randomBytes(16).toString("hex")}`;

  await db.insert(schema.magicLinks).values({
    email: email.toLowerCase(),
    token,
    sessionId,
    expiresAt,
  });

  const baseUrl = process.env.NETWORK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const url = `${baseUrl}/login/auth?token=${token}`;

  return { token, url };
}

/**
 * Build a magic link URL for an email. Used by channel.ts to add
 * "Continue in chat" footer to outbound emails.
 *
 * Creates a magic link tied to the user's existing chat session,
 * or creates a new session if none exists.
 */
export async function getMagicLinkForEmail(
  email: string,
): Promise<string | null> {
  // Find the user's most recent active session
  const [session] = await db
    .select()
    .from(schema.chatSessions)
    .where(
      and(
        eq(schema.chatSessions.authenticatedEmail, email.toLowerCase()),
        sql`${schema.chatSessions.expiresAt} > ${Date.now()}`,
      ),
    )
    .orderBy(sql`${schema.chatSessions.updatedAt} DESC`)
    .limit(1);

  if (!session) {
    // No active session — can't create a magic link without a session
    return null;
  }

  const result = await createMagicLink(email, session.sessionId);
  return result?.url ?? null;
}
