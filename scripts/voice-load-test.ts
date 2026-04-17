/**
 * Brief 180 — Voice guidance endpoint load + cost test.
 *
 * PURPOSE
 *   Proves we did not explode LLM cost by removing the client-side 4s
 *   push throttle. Hits the real /api/v1/voice/guidance endpoint from
 *   N concurrent simulated sessions and reports latency, cache hit rate,
 *   and 304 rate.
 *
 * PASS CRITERIA (Brief 180 AC 14)
 *   - Total Claude calls <= 1.5x the pre-change baseline
 *   - Dedup cache hit rate >= 30%
 *   - 304 rate >= 50% of polling requests
 *   - p95 guidance latency < 4000 ms
 *
 * HOW TO RUN
 *   1. Boot the dev server (or a deployed env) that this script will target:
 *        pnpm dev    # local
 *      Or set VOICE_LOAD_TEST_BASE_URL for a deployed target.
 *
 *   2. Seed the test sessions (inserts N chatSessions rows with voiceTokens):
 *        pnpm tsx scripts/voice-load-test.ts --seed
 *      The seeded session IDs are written to `.context/voice-load-sessions.json`.
 *
 *   3. Baseline on main (BEFORE this brief's changes):
 *        git checkout main
 *        pnpm tsx scripts/voice-load-test.ts --output=.context/baseline-voice.json
 *
 *   4. After this brief's changes:
 *        git checkout <this-branch>
 *        pnpm tsx scripts/voice-load-test.ts --output=.context/branch-voice.json
 *
 *   5. Compare:
 *        pnpm tsx scripts/voice-load-test.ts --compare .context/baseline-voice.json .context/branch-voice.json
 *
 *   Output is a JSON report that Dev Reviewer / Documenter can attach to
 *   the brief completion record.
 *
 * WHY THIS IS NOT AUTOMATED CI
 *   - It burns real LLM credits (unless MOCK_LLM=true on the server).
 *   - It depends on a running server. CI would need a disposable ephemeral
 *     env to be meaningful, which is out of scope for this brief.
 *
 *   Recommended local run: MOCK_LLM=true pnpm dev  (then this script).
 *   The mock LLM path still exercises the dedup/ETag pipeline — the cost
 *   "ratio" becomes latency-of-the-mock, but the hit-rate assertions still
 *   hold and are the main point of the test.
 *
 * SCENARIO
 *   - 10 concurrent sessions (--concurrency=N to override)
 *   - Each session: 4 user-turns/min x 3 min = 12 turns
 *   - Per user turn: 1x POST /voice/transcript, 1x POST /voice/guidance,
 *     1x poll-style POST /voice/guidance at 2s (re-uses ETag from last push)
 *   - Total: ~360 guidance calls across the run
 */

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

type Args = {
  seed?: boolean;
  compare?: [string, string];
  output?: string;
  concurrency: number;
  turnsPerMin: number;
  durationMin: number;
  baseUrl: string;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    concurrency: Number(process.env.VOICE_LOAD_TEST_CONCURRENCY ?? 10),
    turnsPerMin: Number(process.env.VOICE_LOAD_TEST_TURNS_PER_MIN ?? 4),
    durationMin: Number(process.env.VOICE_LOAD_TEST_DURATION_MIN ?? 3),
    baseUrl: process.env.VOICE_LOAD_TEST_BASE_URL ?? "http://localhost:3000",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed") a.seed = true;
    else if (arg === "--compare") a.compare = [argv[++i], argv[++i]];
    else if (arg.startsWith("--output=")) a.output = arg.slice("--output=".length);
    else if (arg.startsWith("--concurrency=")) a.concurrency = Number(arg.slice("--concurrency=".length));
    else if (arg.startsWith("--turns=")) a.turnsPerMin = Number(arg.slice("--turns=".length));
    else if (arg.startsWith("--duration=")) a.durationMin = Number(arg.slice("--duration=".length));
    else if (arg.startsWith("--base=")) a.baseUrl = arg.slice("--base=".length);
  }
  return a;
}

type SessionSeed = { sessionId: string; voiceToken: string };

const SEED_FILE = path.resolve(process.cwd(), ".context/voice-load-sessions.json");

async function seedSessions(args: Args): Promise<void> {
  // The seeder writes directly to the DB. It is only imported when --seed is set
  // so the main load-test loop stays free of DB deps (hits HTTP only).
  console.log(`Seeding ${args.concurrency} test sessions...`);
  const { db } = await import("../src/db");
  const schema = await import("../src/db/schema");
  const seeds: SessionSeed[] = [];
  for (let i = 0; i < args.concurrency; i++) {
    const sessionId = `loadtest-${Date.now()}-${i}`;
    const voiceToken = `ltok-${randomUUID().slice(0, 12)}`;
    await db.insert(schema.chatSessions).values({
      sessionId,
      voiceToken,
      messages: [{ role: "user", content: "Hi" }],
      context: "front-door",
      ipHash: "loadtest",
      messageCount: 1,
      stage: "main",
      personaId: "alex",
    });
    seeds.push({ sessionId, voiceToken });
  }
  await fs.mkdir(path.dirname(SEED_FILE), { recursive: true });
  await fs.writeFile(SEED_FILE, JSON.stringify(seeds, null, 2));
  console.log(`Wrote ${seeds.length} sessions to ${SEED_FILE}`);
}

type Metric = {
  startedAt: number;
  latencyMs: number;
  status: number;
  kind: "push" | "poll";
  wasCached?: boolean;
};

async function runOneSession(
  seed: SessionSeed,
  args: Args,
  metrics: Metric[],
): Promise<void> {
  const { sessionId, voiceToken } = seed;
  const url = `${args.baseUrl}/api/v1/voice/guidance`;
  const transcriptUrl = `${args.baseUrl}/api/v1/voice/transcript`;
  const totalTurns = args.turnsPerMin * args.durationMin;
  const intervalMs = (60_000 / args.turnsPerMin);
  let lastEtag: string | undefined;

  for (let turn = 0; turn < totalTurns; turn++) {
    const turnStarted = Date.now();

    // 1) Flush transcript (one new user line)
    await fetch(transcriptUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        voiceToken,
        turns: [{ role: "user", text: `load-test turn ${turn}` }],
      }),
    }).catch(() => { /* skip failures to keep loop running */ });

    // 2) Push guidance request (no If-None-Match — transcript just changed)
    {
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, voiceToken }),
      }).catch(() => null);
      const latencyMs = performance.now() - t0;
      if (res) {
        const etag = res.headers.get("etag") ?? undefined;
        if (etag) lastEtag = etag;
        const cacheHit = res.headers.get("x-voice-cache-hit") === "1";
        metrics.push({ startedAt: t0, latencyMs, status: res.status, kind: "push", wasCached: cacheHit });
      }
    }

    // 3) Simulate polling at 2s during the remainder of this turn slot
    const pollEnd = turnStarted + intervalMs - 1000;
    while (Date.now() < pollEnd) {
      await sleep(2000);
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(lastEtag ? { "If-None-Match": lastEtag } : {}),
        },
        body: JSON.stringify({ sessionId, voiceToken }),
      }).catch(() => null);
      const latencyMs = performance.now() - t0;
      if (res) {
        const etag = res.headers.get("etag") ?? undefined;
        if (etag) lastEtag = etag;
        metrics.push({ startedAt: t0, latencyMs, status: res.status, kind: "poll" });
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return Math.round(sorted[idx]);
}

type Report = {
  config: Pick<Args, "concurrency" | "turnsPerMin" | "durationMin" | "baseUrl">;
  totals: {
    requests: number;
    push: number;
    poll: number;
    status200: number;
    status304: number;
    statusOther: number;
    cacheHits: number;
  };
  latency: { p50Ms: number; p95Ms: number; meanMs: number };
  rates: { dedupHitRate: number; status304Rate: number };
  durationSeconds: number;
};

function buildReport(args: Args, metrics: Metric[], durationSeconds: number): Report {
  const status200 = metrics.filter((m) => m.status === 200).length;
  const status304 = metrics.filter((m) => m.status === 304).length;
  const cacheHits = metrics.filter((m) => m.wasCached).length;
  const pollCount = metrics.filter((m) => m.kind === "poll").length;
  const latencies = metrics.map((m) => m.latencyMs);
  return {
    config: {
      concurrency: args.concurrency,
      turnsPerMin: args.turnsPerMin,
      durationMin: args.durationMin,
      baseUrl: args.baseUrl,
    },
    totals: {
      requests: metrics.length,
      push: metrics.filter((m) => m.kind === "push").length,
      poll: pollCount,
      status200,
      status304,
      statusOther: metrics.length - status200 - status304,
      cacheHits,
    },
    latency: {
      p50Ms: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95),
      meanMs: Math.round(latencies.reduce((s, v) => s + v, 0) / Math.max(1, latencies.length)),
    },
    rates: {
      dedupHitRate: metrics.length ? cacheHits / metrics.length : 0,
      status304Rate: pollCount ? status304 / pollCount : 0,
    },
    durationSeconds,
  };
}

async function runLoadTest(args: Args): Promise<void> {
  const raw = await fs.readFile(SEED_FILE, "utf-8").catch(() => null);
  if (!raw) {
    console.error(`No seed file found at ${SEED_FILE}. Run --seed first.`);
    process.exit(2);
  }
  const seeds = JSON.parse(raw) as SessionSeed[];
  if (seeds.length < args.concurrency) {
    console.error(`Seed file has ${seeds.length} sessions; need ${args.concurrency}. Re-run --seed.`);
    process.exit(2);
  }
  console.log(
    `Running load test: concurrency=${args.concurrency}, turnsPerMin=${args.turnsPerMin}, ` +
    `duration=${args.durationMin}min, base=${args.baseUrl}`,
  );
  const metrics: Metric[] = [];
  const start = Date.now();
  await Promise.all(
    seeds.slice(0, args.concurrency).map((seed) => runOneSession(seed, args, metrics)),
  );
  const report = buildReport(args, metrics, (Date.now() - start) / 1000);
  const out = JSON.stringify(report, null, 2);
  console.log(out);
  if (args.output) {
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, out);
    console.log(`Wrote report to ${args.output}`);
  }
}

async function compareReports(baselinePath: string, branchPath: string): Promise<void> {
  const [baseline, branch] = await Promise.all([
    fs.readFile(baselinePath, "utf-8").then((s) => JSON.parse(s) as Report),
    fs.readFile(branchPath, "utf-8").then((s) => JSON.parse(s) as Report),
  ]);
  // Claude-call proxy = status200 count on push endpoint (304 = no LLM call).
  const baseClaude = baseline.totals.push + baseline.totals.poll - baseline.totals.status304 - baseline.totals.cacheHits;
  const branchClaude = branch.totals.push + branch.totals.poll - branch.totals.status304 - branch.totals.cacheHits;
  const ratio = baseClaude === 0 ? Infinity : branchClaude / baseClaude;
  const verdict = {
    claude_calls_ratio: Math.round(ratio * 100) / 100,
    claude_calls_ratio_pass: ratio <= 1.5,
    dedup_hit_rate: Math.round(branch.rates.dedupHitRate * 1000) / 1000,
    dedup_hit_rate_pass: branch.rates.dedupHitRate >= 0.30,
    status304_rate: Math.round(branch.rates.status304Rate * 1000) / 1000,
    status304_rate_pass: branch.rates.status304Rate >= 0.50,
    p95_latency_ms: branch.latency.p95Ms,
    p95_latency_pass: branch.latency.p95Ms < 4000,
  };
  console.log("Brief 180 AC 14 verdict:");
  console.log(JSON.stringify(verdict, null, 2));
  const allPass =
    verdict.claude_calls_ratio_pass &&
    verdict.dedup_hit_rate_pass &&
    verdict.status304_rate_pass &&
    verdict.p95_latency_pass;
  console.log(allPass ? "PASS" : "FAIL");
  process.exit(allPass ? 0 : 1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.seed) {
    await seedSessions(args);
    return;
  }
  if (args.compare) {
    await compareReports(args.compare[0], args.compare[1]);
    return;
  }
  await runLoadTest(args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
