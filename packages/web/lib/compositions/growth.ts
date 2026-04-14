/**
 * Ditto — Growth Composition
 *
 * "How's my growth going?" — GTM pipeline dashboards with plan progress,
 * cycle phase, experiments, published content, and last brief.
 *
 * Renders one section per active growth plan using existing block types:
 * metric, status_card, data, checklist, record, text.
 *
 * Provenance: Brief 140 (Growth Composition Intent), routines.ts pattern (adopt).
 */

import type { ContentBlock } from "@/lib/engine";
import type { CompositionContext } from "./types";
import type { ReviewItem } from "@/lib/feed-types";
import { formatRelativeTime } from "./utils";
import { emptyGrowth } from "@/lib/composition-empty-states";

/**
 * Compose the Growth view — GTM pipeline plan dashboards.
 * Pure, synchronous. All data comes from CompositionContext.
 */
export function composeGrowth(context: CompositionContext): ContentBlock[] {
  const { growthPlans, pendingReviews } = context;

  if (!growthPlans || growthPlans.length === 0) {
    return emptyGrowth();
  }

  const blocks: ContentBlock[] = [];

  // Summary metrics across all plans
  const activePlans = growthPlans.filter((p) => p.status !== "completed");
  const totalExperiments = growthPlans.reduce((sum, p) => sum + p.experiments.length, 0);
  const totalPublished = growthPlans.reduce((sum, p) => sum + p.publishedContent.length, 0);

  blocks.push({
    type: "metric",
    metrics: [
      { label: "Growth plans", value: String(growthPlans.length) },
      { label: "Active", value: String(activePlans.length), trend: activePlans.length > 0 ? "up" : "flat" },
      { label: "Experiments", value: String(totalExperiments) },
      { label: "Published", value: String(totalPublished) },
    ],
  });

  // GTM-related pending reviews
  const gtmRunIds = new Set(growthPlans.map((p) => p.runId));
  const gtmReviews = pendingReviews.filter((item) => {
    if (item.itemType !== "review") return false;
    const review = item as ReviewItem;
    return gtmRunIds.has(review.data.processRunId);
  });

  if (gtmReviews.length > 0) {
    blocks.push({ type: "text", text: "Pending reviews", variant: "hero-secondary" });
    for (const review of gtmReviews) {
      if (review.itemType !== "review") continue;
      const r = review as ReviewItem;
      blocks.push({
        type: "record",
        title: r.data.processName,
        subtitle: r.data.stepName,
        status: { label: "Needs review", variant: "caution" },
        fields: [
          { label: "Output", value: r.data.outputText.slice(0, 120) + (r.data.outputText.length > 120 ? "..." : "") },
        ],
        actions: [
          { id: `review-${r.id}`, label: "Review" },
        ],
      });
    }
  }

  // Per-plan sections
  for (const plan of growthPlans) {
    // Plan header — metric block with plan name and cycle info
    blocks.push({
      type: "metric",
      metrics: [
        { label: plan.planName, value: `Cycle ${plan.cycleNumber}` },
        ...(plan.gtmContext.goals?.length
          ? [{ label: "Goals", value: String(plan.gtmContext.goals.length) }]
          : []),
        ...(plan.publishedContent.length > 0
          ? [{ label: "Posts", value: String(plan.publishedContent.length) }]
          : []),
      ],
    });

    // Current cycle phase — status card
    blocks.push({
      type: "status_card",
      entityType: "work_item",
      entityId: plan.runId,
      status: plan.status === "completed" ? "positive" : plan.status === "waiting_review" ? "caution" : "info",
      title: plan.currentStep,
      details: { started: formatRelativeTime(plan.startedAt) },
    });

    // Experiments — data table
    if (plan.experiments.length > 0) {
      blocks.push({
        type: "data",
        format: "table",
        title: "Experiments",
        headers: ["Track", "Experiment", "Verdict"],
        data: plan.experiments.map((exp) => ({
          Track: exp.track,
          Experiment: exp.description,
          Verdict: exp.verdict ?? "pending",
        })),
      });
    }

    // Published content — checklist with post links
    if (plan.publishedContent.length > 0) {
      blocks.push({
        type: "checklist",
        title: "Published content",
        items: plan.publishedContent.map((post) => ({
          label: `${post.platform}${post.postUrl ? ` — ${post.postUrl}` : ""}`,
          status: "done" as const,
          ...(post.publishedAt ? { detail: formatRelativeTime(post.publishedAt) } : {}),
        })),
      });
    }

    // Channel recommendations from gtmContext
    if (plan.gtmContext.channels && plan.gtmContext.channels.length > 0) {
      blocks.push({
        type: "record",
        title: "Target channels",
        fields: plan.gtmContext.channels.map((ch) => ({
          label: "Channel",
          value: ch,
        })),
      });
    }

    // Last brief — text block
    if (plan.lastBrief) {
      blocks.push({
        type: "text",
        text: `Last brief\n\n${plan.lastBrief}`,
        variant: "hero-secondary",
      });
    }
  }

  return blocks;
}
