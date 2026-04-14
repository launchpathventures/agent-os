/**
 * POST /api/v1/network/inbound — AgentMail inbound webhook (Brief 098b AC1-2).
 *
 * Returns 200 immediately, processes the email asynchronously.
 * Validates AgentMail/Svix signature headers — rejects unsigned/invalid with 401.
 *
 * Layer classification: L6 (Human/entry point).
 * Provenance: AgentMail webhook-agent example (pattern), Brief 098b.
 */

import { NextResponse } from "next/server";
import { Webhook } from "svix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Load env from root .env (monorepo: packages/web/ doesn't auto-read root .env)
  try {
    const { config } = await import("dotenv");
    const path = await import("path");
    config({ path: path.resolve(process.cwd(), "../../.env") });
  } catch { /* env vars may be set via platform */ }

  const webhookSecret = process.env.AGENTMAIL_WEBHOOK_SECRET;

  // AC2: Validate signature — reject unsigned/invalid requests
  if (!webhookSecret) {
    console.error("[/api/v1/network/inbound] AGENTMAIL_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  const wh = new Webhook(webhookSecret);
  try {
    wh.verify(rawBody, headers);
  } catch {
    console.warn("[/api/v1/network/inbound] Invalid or missing signature");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 },
    );
  }

  // AC1: Return 200 immediately
  // Parse the payload and process asynchronously
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  // Fire-and-forget async processing — don't block the response
  // Use dynamic import to avoid bundling engine code at route level
  processAsync(payload).catch((err) => {
    console.error("[/api/v1/network/inbound] Async processing error:", err);
  });

  return NextResponse.json({ ok: true });
}

/**
 * Extract a bare email address from an AgentMail formatted sender string.
 *
 * AgentMail `from` field is type `MessageFrom = string` in format:
 *   - "username@domain.com"
 *   - "Display Name <username@domain.com>"
 *
 * See: https://docs.agentmail.to/events
 */
function extractEmail(formatted: string): string {
  if (!formatted) return "";
  // Match email in angle brackets: "Display Name <email@domain.com>"
  const match = formatted.match(/<([^>]+)>/);
  if (match) return match[1];
  // Already a bare email address
  return formatted.trim();
}

/**
 * Normalize AgentMail webhook payload to the InboundEmailPayload shape.
 *
 * AgentMail webhook payload (from https://docs.agentmail.to/events):
 * {
 *   "type": "event",
 *   "event_type": "message.received",
 *   "event_id": "evt_123abc...",
 *   "message": {
 *     "from": "Jane Doe <jane@example.com>",   // string, may include display name
 *     "inbox_id": "inbox_def456...",
 *     "thread_id": "thd_789ghi...",
 *     "message_id": "<abc123@agentmail.to>",
 *     "to": ["Support Agent <support@agentmail.to>"],
 *     "subject": "Email Subject",
 *     "text": "The full text body of the email.",
 *     "preview": "A short preview...",
 *     "html": "<html>...</html>",
 *     "labels": ["received"],
 *     "size": 2048,
 *     "timestamp": "2023-10-27T10:00:00Z",
 *     "created_at": "...",
 *     "updated_at": "..."
 *   },
 *   "thread": { ... }
 * }
 *
 * Key notes:
 * - `from` is a plain string (not `from_`, not an array)
 * - `from` may include display name: "Jane Doe <jane@example.com>"
 * - `to` is an array of formatted strings
 * - `text` and `html` may be absent for payloads > 1MB (use Get Message API)
 * - No `extracted_text` in webhook payload — only available via SDK getMessage()
 */
function normalizePayload(raw: Record<string, unknown>): import("@engine/inbound-email").InboundEmailPayload {
  const msg = (raw.message ?? {}) as Record<string, unknown>;

  // `from` is a string like "Jane Doe <jane@example.com>" or "jane@example.com"
  const fromRaw = (msg.from ?? "") as string;
  const from = extractEmail(fromRaw);

  // `to` is an array of formatted strings — extract bare emails
  const toRaw = msg.to as string[] | undefined;
  const to = toRaw?.map(extractEmail);

  return {
    eventType: (raw.event_type ?? raw.eventType ?? "") as string,
    message: {
      from,
      to,
      subject: (msg.subject ?? undefined) as string | undefined,
      text: (msg.text ?? undefined) as string | undefined,
      // extracted_text not available in webhook payload — only via SDK getMessage()
      extractedText: undefined,
      messageId: (msg.message_id ?? msg.messageId ?? undefined) as string | undefined,
      threadId: (msg.thread_id ?? msg.threadId ?? undefined) as string | undefined,
    },
  };
}

async function processAsync(payload: unknown): Promise<void> {
  const { processInboundEmail } = await import(
    "@engine/inbound-email"
  );

  const normalized = normalizePayload(payload as Record<string, unknown>);

  // Fetch extracted_text via SDK if AgentMail is configured and we have a messageId
  // Webhook payloads don't include extracted_text — only the getMessage() API does
  const msg = (payload as Record<string, unknown>).message as Record<string, unknown>;
  const inboxId = msg?.inbox_id as string | undefined;
  if (normalized.message.messageId && inboxId && !normalized.message.extractedText) {
    try {
      const apiKey = process.env.AGENTMAIL_API_KEY;
      if (apiKey) {
        const { AgentMailClient } = await import("agentmail");
        const client = new AgentMailClient({ apiKey });
        // SDK path: client.inboxes.messages.get(inbox_id, message_id)
        const fullMessage = await client.inboxes.messages.get(inboxId, normalized.message.messageId);
        if (fullMessage.extractedText) {
          normalized.message.extractedText = fullMessage.extractedText;
        }
      }
    } catch (err) {
      // Non-fatal — text field is the fallback
      console.warn("[/api/v1/network/inbound] Could not fetch extracted_text:", (err as Error).message);
    }
  }

  console.log(
    `[/api/v1/network/inbound] Processing: event=${normalized.eventType} from=${normalized.message.from || "(none)"} subject="${normalized.message.subject || "(none)"}"`,
  );

  const result = await processInboundEmail(normalized);

  console.log(
    `[/api/v1/network/inbound] Processed: action=${result.action}` +
    (result.personId ? ` person=${result.personId.slice(0, 8)}` : "") +
    (result.details ? ` details=${result.details}` : ""),
  );
}
