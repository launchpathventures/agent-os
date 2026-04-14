/**
 * Ditto Web — Growth Plans API
 *
 * GET /api/growth — Returns GrowthPlanSummary[] from active GTM pipeline runs.
 * Data assembled server-side for the growth composition intent (Brief 140).
 *
 * Provenance: Brief 140 (Growth Composition Intent), roadmap API pattern (Brief 055).
 */

import { NextResponse } from "next/server";
import { applyConfigToEnv, loadConfig } from "@/lib/config";

async function getProcessEngine() {
  const config = loadConfig();
  if (config) applyConfigToEnv(config);

  const processData = await import("../../../../../src/engine/process-data");
  return processData;
}

export async function GET() {
  try {
    const engine = await getProcessEngine();
    const growthPlans = await engine.getGrowthPlans();
    return NextResponse.json(growthPlans);
  } catch (error) {
    console.error("Growth API error:", error);
    return NextResponse.json(
      { error: "Failed to load growth data" },
      { status: 500 },
    );
  }
}
