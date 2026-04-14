/**
 * Ditto — Outreach Table: Dual-Surface Rendering
 *
 * Renders outreach batch summaries as:
 * - Inline-styled HTML tables for email (renderOutreachTableHtml)
 * - InteractiveTableBlocks for workspace (buildOutreachTableBlock)
 *
 * Same data, surface-appropriate format. HTML uses inline styles only
 * for email client compatibility.
 *
 * Provenance: Brief 149, Insight-182 (plan-approve-execute),
 * Stripe receipt emails + Linear digest emails (HTML table pattern).
 */

import { db, schema } from "../db";
import { eq, and, gt } from "drizzle-orm";
import type {
  InteractiveTableBlock,
  TableColumn,
  TableRow,
} from "@ditto/core";

// ============================================================
// Types
// ============================================================

export type OutreachStatus = "sent" | "replied" | "interested" | "opted_out" | "pending";

export interface OutreachPersonSummary {
  personName: string;
  company: string;
  status: OutreachStatus;
  sentAt: Date;
  replySnippet?: string;
}

export interface OutreachBatchSummary {
  entries: OutreachPersonSummary[];
  totalSent: number;
  totalReplied: number;
  totalInterested: number;
  totalOptedOut: number;
  responseRate: number;
}

// ============================================================
// Status pill colours (inline styles for email)
// ============================================================

const STATUS_PILL_STYLES: Record<OutreachStatus, { bg: string; color: string; label: string }> = {
  interested: { bg: "#dcfce7", color: "#166534", label: "Interested" },
  sent: { bg: "#f3f4f6", color: "#6b7280", label: "Sent" },
  pending: { bg: "#f3f4f6", color: "#6b7280", label: "Pending" },
  replied: { bg: "#fef3c7", color: "#92400e", label: "Replied" },
  opted_out: { bg: "#fef2f2", color: "#991b1b", label: "Opted Out" },
};

// ============================================================
// HTML Renderer (Email Surface)
// ============================================================

/**
 * Render an OutreachBatchSummary as an inline-styled HTML table.
 *
 * Uses Ditto theme: system font stack, 560px max-width, alternating
 * #f9f9f9 rows, colour-coded status pills. All inline styles for
 * email client compatibility.
 */
export function renderOutreachTableHtml(summary: OutreachBatchSummary): string {
  if (summary.entries.length === 0) {
    return "";
  }

  const rows = summary.entries
    .map((entry, i) => {
      const pill = STATUS_PILL_STYLES[entry.status];
      const bgColor = i % 2 === 1 ? "#f9f9f9" : "#ffffff";
      const dateStr = entry.sentAt.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      });

      return `<tr style="background-color: ${bgColor};">
  <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(entry.personName)}</td>
  <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(entry.company)}</td>
  <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">
    <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; background-color: ${pill.bg}; color: ${pill.color};">${pill.label}</span>
  </td>
  <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${dateStr}</td>
</tr>`;
    })
    .join("\n");

  const metricsLine = [
    `${summary.totalSent} sent`,
    summary.totalReplied > 0 ? `${summary.totalReplied} replied` : null,
    summary.totalInterested > 0 ? `${summary.totalInterested} interested` : null,
    summary.totalOptedOut > 0 ? `${summary.totalOptedOut} opted out` : null,
    `${Math.round(summary.responseRate * 100)}% response rate`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<table style="width: 100%; max-width: 560px; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a1a1a; margin: 16px 0;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Name</th>
      <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Company</th>
      <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Status</th>
      <th style="padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Date</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
<p style="font-size: 13px; color: #6b7280; margin: 4px 0 16px;">${metricsLine}</p>`;
}

/**
 * Render a plain-text fallback for email clients that don't support HTML.
 */
export function renderOutreachTablePlainText(summary: OutreachBatchSummary): string {
  if (summary.entries.length === 0) {
    return "";
  }

  const lines = summary.entries.map((entry) => {
    const pill = STATUS_PILL_STYLES[entry.status];
    const dateStr = entry.sentAt.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
    return `- ${entry.personName} (${entry.company}) — ${pill.label} — ${dateStr}`;
  });

  const metricsLine = [
    `${summary.totalSent} sent`,
    summary.totalReplied > 0 ? `${summary.totalReplied} replied` : null,
    summary.totalInterested > 0 ? `${summary.totalInterested} interested` : null,
    `${Math.round(summary.responseRate * 100)}% response rate`,
  ]
    .filter(Boolean)
    .join(", ");

  return ["Outreach Results:", ...lines, "", metricsLine].join("\n");
}

// ============================================================
// InteractiveTableBlock Renderer (Workspace Surface)
// ============================================================

/**
 * Build an InteractiveTableBlock from an OutreachBatchSummary.
 *
 * Uses the existing InteractiveTableBlock type from @ditto/core.
 * Includes per-row actions: view thread, skip follow-up.
 */
export function buildOutreachTableBlock(
  summary: OutreachBatchSummary,
): InteractiveTableBlock {
  const columns: TableColumn[] = [
    { key: "name", label: "Name", format: "text" },
    { key: "company", label: "Company", format: "text" },
    { key: "status", label: "Status", format: "badge" },
    { key: "date", label: "Date", format: "text" },
  ];

  const rows: TableRow[] = summary.entries.map((entry, i) => {
    const pill = STATUS_PILL_STYLES[entry.status];
    return {
      id: `outreach-${i}`,
      cells: {
        name: entry.personName,
        company: entry.company,
        status: pill.label,
        date: entry.sentAt.toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
        }),
      },
      status: entry.status === "interested"
        ? "approved"
        : entry.status === "opted_out"
          ? "error"
          : "pending",
      actions: [
        { id: "view-thread", label: "View thread", style: "secondary" },
        { id: "skip-followup", label: "Skip follow-up", style: "secondary" },
      ],
    };
  });

  const metricsLine = [
    `${summary.totalSent} sent`,
    summary.totalReplied > 0 ? `${summary.totalReplied} replied` : null,
    summary.totalInterested > 0 ? `${summary.totalInterested} interested` : null,
    `${Math.round(summary.responseRate * 100)}% response rate`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    type: "interactive_table",
    title: "Outreach Results",
    summary: metricsLine,
    columns,
    rows,
    selectable: true,
    batchActions: [
      { id: "skip-all-followup", label: "Skip all follow-ups", style: "secondary" },
      { id: "mark-priority", label: "Mark as priority", style: "primary" },
    ],
  };
}

// ============================================================
// Data Gathering
// ============================================================

/**
 * Map interaction outcome to outreach status.
 */
function mapOutcomeToStatus(
  type: string,
  outcome: string | null,
): OutreachStatus {
  if (type === "reply_received") {
    if (outcome === "positive") return "interested";
    if (outcome === "negative") return "opted_out";
    return "replied";
  }
  if (type === "opt_out") return "opted_out";
  return "sent";
}

/**
 * Gather outreach batch summary from interactions since a given date.
 *
 * Queries the interactions table for outreach_sent and reply_received
 * interactions, joins with people for names and organizations.
 */
export async function gatherOutreachBatchSummary(
  userId: string,
  since: Date,
): Promise<OutreachBatchSummary> {
  const interactions = await db
    .select({
      id: schema.interactions.id,
      type: schema.interactions.type,
      outcome: schema.interactions.outcome,
      summary: schema.interactions.summary,
      personId: schema.interactions.personId,
      personName: schema.people.name,
      personOrg: schema.people.organization,
      createdAt: schema.interactions.createdAt,
    })
    .from(schema.interactions)
    .leftJoin(schema.people, eq(schema.interactions.personId, schema.people.id))
    .where(
      and(
        eq(schema.interactions.userId, userId),
        gt(schema.interactions.createdAt, since),
      ),
    );

  // Filter to outreach-related interactions
  const outreachTypes = ["outreach_sent", "reply_received", "opt_out"];
  const outreach = interactions.filter((i) => outreachTypes.includes(i.type));

  // Group by person — show most meaningful status per person.
  // Priority: interested > replied > opted_out > sent > pending
  // When timestamps are equal, higher-priority status wins.
  const STATUS_PRIORITY: Record<OutreachStatus, number> = {
    interested: 4,
    replied: 3,
    opted_out: 2,
    sent: 1,
    pending: 0,
  };

  const byPerson = new Map<string, OutreachPersonSummary>();
  for (const i of outreach) {
    const key = i.personId;
    const existing = byPerson.get(key);
    const status = mapOutcomeToStatus(i.type, i.outcome);
    const createdAt = i.createdAt ?? new Date();

    if (!existing) {
      byPerson.set(key, {
        personName: i.personName || "Unknown",
        company: i.personOrg || "",
        status,
        sentAt: createdAt,
        replySnippet: i.type === "reply_received" ? i.summary?.slice(0, 100) : undefined,
      });
    } else {
      // Update if this interaction is newer, or same time but higher priority
      const isNewer = createdAt > existing.sentAt;
      const isSameTime = createdAt.getTime() === existing.sentAt.getTime();
      const isHigherPriority = STATUS_PRIORITY[status] > STATUS_PRIORITY[existing.status];

      if (isNewer || (isSameTime && isHigherPriority)) {
        byPerson.set(key, {
          personName: i.personName || "Unknown",
          company: i.personOrg || "",
          status,
          sentAt: createdAt,
          replySnippet: i.type === "reply_received" ? i.summary?.slice(0, 100) : existing.replySnippet,
        });
      }
    }
  }

  const entries = [...byPerson.values()];
  const totalSent = entries.length;
  const totalReplied = entries.filter((e) => e.status === "replied" || e.status === "interested").length;
  const totalInterested = entries.filter((e) => e.status === "interested").length;
  const totalOptedOut = entries.filter((e) => e.status === "opted_out").length;
  const responseRate = totalSent > 0 ? totalReplied / totalSent : 0;

  return {
    entries,
    totalSent,
    totalReplied,
    totalInterested,
    totalOptedOut,
    responseRate,
  };
}

// ============================================================
// HTML Escape (local — avoids circular dep with channel.ts)
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
