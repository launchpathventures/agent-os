# Brief: Social Growth Plans — Process-Native GTM Social UI

**Date:** 2026-04-13
**Status:** draft
**Depends on:** GTM Pipeline v2 (cycle + template — complete), Deliberative Perspectives (Brief 136 — complete), Unipile social channel adapter (Brief 133 — complete), Workspace three-panel layout (complete), Block registry (complete), Composition engine (6 intents — complete), Process runner with gate approval (complete), Cycle self-tools (5 tools — complete), Feed assembler (complete), Surface actions (complete)
**Unlocks:** Multi-channel analytics, engagement tracking loop, asset pipeline

## Goal

- **Roadmap phase:** Phase 14: Network Agent (GTM track)
- **Capabilities:** GTM cycle dashboard, structured GATE review for experiments, posting queue, multiple audience-focused growth plans, perspective-driven research, progress tracking

## Context

The GTM pipeline infrastructure is complete:
- `processes/templates/gtm-pipeline.yaml` — 10-step SENSE→ASSESS→ACT→GATE→LAND→LEARN→BRIEF cycle
- Scheduler fires cycles on cron, heartbeat executes steps, trust gate pauses at GATE (`executor: human`)
- Cycle self-tools: activate/pause/resume/briefing/status
- Auto-restart on completion when `continuous: true`, feeding learn outputs into next cycle
- Process-scoped memories accumulate across cycles via memory-assembly handler
- Feed assembler builds ReviewCardBlocks from `waiting_review` runs
- Surface actions route approve/edit/reject back to the engine

The workspace UI is built:
- Three-panel layout, sidebar with 6 composition intents (today/inbox/work/projects/routines/roadmap)
- 24 content block types rendered by BlockRegistry
- Process runner component for stepped detail views
- Review card with approve/edit/reject actions wired to surface-actions

**What's missing is the seam between these two layers.** The user has no way to:
1. See a running GTM cycle's progress
2. Review experiments at the GATE with structured presentation (ReviewCardBlock shows generic outputText)
3. Read the BRIEF output as a dashboard
4. Queue and track manual posts
5. Create audience-focused plans that configure cycle inputs

### Architecture insight: Plan = Process Instance

A Social Growth Plan is **not** a new first-class object. It's a configured instance of the `gtm-pipeline` process template.

| "Plan" concept | Maps to existing primitive |
|---|---|
| Audience, channels, goals | `processRuns.inputs` (the `gtmContext` input) |
| Strategy | Step output from research/ASSESS, approved at GATE |
| Language bank, learnings | `memories` table (scope: process, type: context) |
| Experiments + verdicts | Step outputs from ASSESS/LEARN phases |
| Schedule (M/Th 8am) | `schedules` table entry (cron) |
| Posting queue | GATE step's `waiting_review` state |
| Multiple plans | Multiple process instances of the same template |
| Pause/resume | `pause_cycle` / `resume_cycle` self-tools |
| Progress tracking | `feedback.metrics` on the process definition |
| Cross-cycle learning | Auto-restart feeds `learnOutputs` + `previousCycleRunId` into next run |

No new DB tables. No parallel object model. The process system IS the plan system.

### What's actually new

1. **A `growth` composition intent** — sidebar entry + composition function that renders GTM process instances as plan dashboards
2. **GTM-aware block composition** — the composition function reads step outputs and renders them as structured blocks (experiments, posting queue, metrics) instead of generic text
3. **Unipile Posts API adapter** — extends channel layer to publish LinkedIn feed posts via `client.users.createPost()` (not the DM adapter)
4. **X API v2 adapter** — new `XApiClient` for tweets, threads, and X DMs ($0.01/tweet pay-per-use)
5. **Structured `gtmContext` input schema** — so audience/channels/goals are typed, not freeform JSON
6. **Perspectives integration in the cycle YAML** — `harness.perspectives` config on SENSE/ASSESS steps
7. **`gtm-pipeline` added to cycleType union** — so cycle-tools can activate it
8. **`land-outreach` wired to Unipile** — so outreach DMs on LinkedIn send automatically via the existing UnipileAdapter (Brief 133) after GATE approval

## Non-Goals

- New DB tables for plans (use process instances)
- Channels beyond LinkedIn and X (extend later)
- Buffer integration (both channels now publish natively — Unipile for LinkedIn, X API for X)
- Paid advertising or boosted posts
- Video production (script recommendations yes, production no)
- Real-time social listening dashboards
- Custom block React components (compose from existing 24 types)

## Design

### 1. Structured gtmContext Input

The `gtm-pipeline` template's `gtmContext` input gets a typed schema. This IS the plan definition:

```typescript
interface GTMContext {
  // Plan identity
  planName: string                        // "Developer mindshare on X"

  // Audience (the "who")
  audience: {
    description: string                   // "Senior developers building with AI agents"
    painPoints: string[]                  // What they're frustrated about
    language: string[]                    // How they talk about it (language bank seed)
    whereTheyHangOut: string[]            // Communities, hashtags, accounts they follow
  }

  // Channels (the "where")
  channels: ("linkedin" | "x")[]

  // Goals (the "how much")
  goals: {
    primary: string                       // "500 → 2,000 followers in 90 days"
    metrics: { name: string; current: number; target: number }[]
    timeframeDays: number
  }

  // Strategy (Ditto fills this after research, user approves)
  strategy?: {
    positioning: string
    contentPillars: { name: string; description: string }[]
    postingCadence: Record<string, number>  // { x: 5, linkedin: 3 } per week
    formatMix: Record<string, number>       // { thread: 30, post: 40, article: 20 }
    assetRecommendations: { type: string; rationale: string; generationPrompt: string }[]
    competitorInsights: string[]
    approvedAt?: string
  }

  // Cross-cycle accumulated state (auto-restart feeds this forward)
  experiments?: { id: string; description: string; track: string; verdict?: string; evidence?: string }[]
  languageBank?: string[]
}
```

This flows through `processRuns.inputs` → `HarnessContext.processRun.inputs` → available to every step.

### 2. Plan Creation Flow

User creates a plan through conversation with Self:

```
User: "I want to grow my developer audience on X"

Self: asks clarifying questions (audience, goals, assets, competitors)

Self: calls activate_cycle({
  cycleType: "gtm-pipeline",
  cycleConfig: {
    icp: "Senior developers building with AI agents",
    goals: "2,000 followers in 90 days",
    channels: ["x"],
    cadence: "twice-weekly",
    continuous: true
  }
})

→ startProcessRun("gtm-pipeline", { gtmContext: { ... } }, "self:activate_cycle")
→ Scheduler registers cron
→ First cycle begins with research-heavy SENSE + ASSESS (perspectives fire)
→ Strategy proposal surfaces at GATE as structured review
→ User approves → strategy saved to gtmContext for subsequent cycles
```

**Multiple plans** = multiple `activate_cycle` calls with different `gtmContext` inputs. Each creates a separate process run that auto-restarts continuously.

### 3. Perspectives Integration

Add `harness.perspectives` config to the GTM cycle's research-intensive steps:

```yaml
# In processes/templates/gtm-pipeline.yaml (and cycles/gtm-pipeline.yaml)

steps:
  - id: sense
    name: "SENSE: Find people with the pain"
    executor: ai-agent
    harness:
      perspectives:
        enabled: true
        trigger: "always"          # Research always gets full council
        peer_review: true
        max_lenses: 5
        composer_hints:
          - "social media audience growth research"
          - "identify real pain signals vs noise"

  - id: assess
    name: "ASSESS: Pick 3 experiments"
    executor: ai-agent
    harness:
      perspectives:
        enabled: true
        trigger: "always"
        peer_review: true
        max_lenses: 4
        composer_hints:
          - "experiment design for social media growth"
          - "channel-specific content strategy"
          - "audience-channel fit analysis"
```

The Lens Composer dynamically generates context-appropriate lenses based on the audience and channels in `gtmContext`. For a developer audience on X it might produce:

- **Developer Community Analyst** — What makes devs follow/engage? Code > claims.
- **Platform Algorithm Specialist** — X's current engagement mechanics, thread vs post performance
- **Competitive Intelligence Lens** — Who's growing fastest in this space and why
- **Content Sustainability Assessor** — Can this cadence be maintained?

For an SMB-owner audience on LinkedIn:

- **Decision-Maker Empathy Lens** — What problems keep them up? What language resonates?
- **LinkedIn Algorithm Specialist** — Document posts, comment engagement patterns
- **Thought Leadership Authenticity Lens** — Real person or brand?
- **Conversion Path Analyst** — Content engagement → pipeline conversion

Content at the GATE also gets perspective evaluation (2-3 lenses, `trigger: "high-stakes"`).

### 4. Growth Composition Intent

New composition intent added to the sidebar and composition engine:

```
SIDEBAR
├─ Today
├─ Inbox [3]
├─ Work
├─ Projects
├─ Growth              ← NEW intent
│   (shows active GTM cycle instances as "plans")
├─ Routines
├─ Roadmap
└─ Settings
```

**Composition function** (`packages/web/lib/compositions/growth.ts`):

```typescript
export function composeGrowth(context: CompositionContext): ContentBlock[] {
  const blocks: ContentBlock[] = []

  // 1. Find all active GTM pipeline process instances
  const gtmRuns = context.activeRuns.filter(r => r.processSlug === "gtm-pipeline")

  if (gtmRuns.length === 0) {
    // Empty state — suggest creating a plan
    blocks.push({
      type: "suggestion",
      title: "No growth plans yet",
      body: "Tell me about an audience you want to reach and I'll create a growth plan.",
      actions: [{ id: "suggest-create-plan", label: "Create a plan", style: "primary" }]
    })
    return blocks
  }

  // 2. For each plan (GTM process instance), render a plan section
  for (const run of gtmRuns) {
    const gtmContext = run.inputs?.gtmContext as GTMContext

    // Plan header — metric block with progress
    blocks.push({
      type: "metric",
      label: gtmContext.planName,
      value: gtmContext.goals.metrics[0]?.current ?? 0,
      target: gtmContext.goals.metrics[0]?.target,
      trend: "up",  // computed from historical
      subtitle: `Cycle ${run.cycleNumber} · ${channelLabels(gtmContext.channels)}`
    })

    // Current cycle phase — status_card
    blocks.push({
      type: "status_card",
      title: `Current: ${run.currentStepId?.toUpperCase() ?? "starting"}`,
      status: run.status === "running" ? "in_progress" : run.status,
      body: stepDescription(run.currentStepId)
    })

    // Pending reviews at GATE — review_card blocks (from feed assembler)
    const pendingForPlan = context.pendingReviews
      .filter(r => r.data.processRunId === run.id)
    for (const review of pendingForPlan) {
      blocks.push(review.data.blocks?.[0] ?? {
        type: "review_card",
        ...review.data
      })
    }

    // Published content — checklist of what's been posted with links
    const published = run.publishedContent ?? []
    if (published.length > 0) {
      blocks.push({
        type: "checklist",
        title: "Published This Cycle",
        items: published.map(post => ({
          label: `${post.platform}: "${post.content.slice(0, 60)}..."`,
          status: "done",
          detail: post.postUrl
        }))
      })
    }

    // Experiments — data block (table format)
    const experiments = getExperiments(run)
    if (experiments.length > 0) {
      blocks.push({
        type: "data",
        title: "Experiments",
        format: "table",
        columns: ["Track", "Experiment", "Result", "Verdict"],
        rows: experiments.map(e => [
          e.track, e.description,
          e.evidence ?? "pending",
          e.verdict ?? "running"
        ])
      })
    }

    // Asset recommendations — record blocks with generation prompt action
    const assets = gtmContext.strategy?.assetRecommendations ?? []
    for (const asset of assets) {
      blocks.push({
        type: "record",
        title: asset.type,
        fields: [
          { label: "Why", value: asset.rationale },
        ],
        actions: [
          { id: `asset.generate.${asset.type}`, label: "Generate with prompt", style: "secondary" }
        ]
      })
    }

    // Last brief — text block with cycle digest
    const lastBrief = getLastBrief(run)
    if (lastBrief) {
      blocks.push({
        type: "text",
        content: `### Last Cycle Brief\n\n${lastBrief}`
      })
    }
  }

  return blocks
}
```

**Key insight:** This composition function uses **only existing block types**. No new React components. The block registry already renders metric, status_card, review_card, checklist, data, record, and text blocks.

### 5. Structured GATE Presentation

The current feed assembler builds ReviewCardBlock from `waiting_review` runs with generic `outputText`. For GTM cycles, the step output from ACT phases is structured (experiments with drafts, hypotheses, kill criteria).

**Enhancement to feed assembler:** When building ReviewCardBlock for a GTM pipeline run at the GATE step, parse the step output as structured experiments and render a richer block:

```typescript
// In feed-assembler.ts — GTM-specific review card enrichment
if (process.slug === "gtm-pipeline" && waitingStep?.stepId === "gate") {
  // Parse experiments from ACT step outputs
  const credibility = getStepOutput(run, "act-credibility")
  const painNaming = getStepOutput(run, "act-pain-naming")
  const outreach = getStepOutput(run, "act-outreach")

  // Build review card with structured experiment data
  reviewBlock.outputText = formatExperimentsForReview({
    credibility, painNaming, outreach
  })
  // outputText is markdown — the existing ReviewCardBlock renders it
}
```

The formatted output looks like:

```markdown
## Credibility: X thread on trust-earning in agent systems

**Hook:** "Most agent frameworks solve the wrong problem..."
**Target:** AI/ML developers on X
**Hypothesis:** Showing real code from our codebase drives engagement
**Kill criteria:** <50 impressions after 48h
**Confidence:** 4/5

[Full draft below]
---
[thread content]

## Pain-naming: LinkedIn post on "agent amnesia"

**Hook:** "Every morning I re-explain my business to my AI assistant..."
...
```

The user sees this in the existing ReviewCardBlock with approve/edit/reject actions. No new component needed.

### 6. Automated Content Publishing (Both Channels)

All delivery is automated after GATE approval. No manual posting queue needed.

| Track | Output | Delivery | Adapter |
|-------|--------|----------|---------|
| Credibility + Pain-naming | LinkedIn **feed posts** | Automated | Unipile Posts API (`client.users.createPost()`) |
| Credibility + Pain-naming | X **tweets/threads** | Automated | X API v2 (`POST /2/tweets`, pay-per-use ~$0.01/tweet) |
| Outreach | LinkedIn **DMs** | Automated | Unipile Messaging API (Brief 133, already built) |
| Outreach | X **DMs** | Automated | X API v2 (`POST /2/dm_conversations`) |
| Outreach | **Emails** | Automated | AgentMailAdapter (existing) |

After the user approves at the GATE:
- `land-content` publishes feed posts via Unipile (LinkedIn) or X API (X)
- `land-outreach` sends DMs/emails via Unipile (LinkedIn), X API (X DMs), or AgentMail (email)

Both adapters follow the `ChannelAdapter` pattern. The trust gate at GATE is the control point — everything after approval is automated.

**Unipile Posts API** (for LinkedIn feed posts):
```typescript
// Unipile SDK — separate from messaging
const result = await client.users.createPost({
  account_id: unipileAccountId,
  text: postContent,
  attachments: imageBuffer ? [["image.png", imageBuffer]] : undefined,
});
```

**X API v2** (for tweets and threads):
```typescript
// X API — post a tweet
const result = await fetch("https://api.x.com/2/tweets", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ text: tweetContent }),
});

// Thread: post sequentially, each reply_to the previous
const result = await fetch("https://api.x.com/2/tweets", {
  method: "POST",
  body: JSON.stringify({ text: tweet2, reply: { in_reply_to_tweet_id: tweet1Id } }),
});
```

**Cost:** Unipile for LinkedIn (already paying per connected account). X API pay-per-use at $0.01/tweet (~$1-2/month for typical growth plan volume).

**Published content tracking:** `land-content` records each published post in `stepRuns.outputs` with platform, post ID, URL, and timestamp. The LEARN step reads these to check engagement next cycle.

### 7. Asset Recommendations

Asset recommendations surface as `record` blocks with a "Generate with prompt" action. The action triggers a conversation with Self, pre-loaded with the generation prompt from the strategy:

```typescript
// In surface-actions.ts
case "asset": {
  const [_, assetType] = parts  // asset.generate.{type}
  const prompt = getAssetGenerationPrompt(assetType, gtmContext)

  // Inject prompt into conversation as a suggestion
  return {
    blocks: [{
      type: "suggestion",
      title: `Generate: ${assetType}`,
      body: prompt,
      actions: [
        { id: "suggest-accept", label: "Run this prompt", style: "primary" },
        { id: "suggest-dismiss", label: "Skip", style: "secondary" }
      ]
    }]
  }
}
```

The user clicks "Run this prompt" → Self receives the prompt → produces the asset (README, landing page draft, checklist) → presents for review. No special machinery — it's just a conversation.

### 8. Cycle Type Extension

Add `gtm-pipeline` to the `cycleType` union so cycle-tools can manage it:

```typescript
// In packages/core/src/db/schema.ts
// Current: "sales-marketing" | "network-connecting" | "relationship-nurture"
// New:     "sales-marketing" | "network-connecting" | "relationship-nurture" | "gtm-pipeline"
```

And in `cycle-tools.ts`, add the mapping:

```typescript
const CYCLE_PROCESS_MAP = {
  "sales-marketing": "sales-marketing-cycle",
  "network-connecting": "network-connecting-cycle",
  "relationship-nurture": "relationship-nurture-cycle",
  "gtm-pipeline": "gtm-pipeline",  // NEW
}
```

## Plan Lifecycle Summary

```
CONVERSATION: "I want to grow my dev audience on X"
    │
    ▼
activate_cycle(gtm-pipeline, gtmContext={audience, channels, goals})
    │  → processRun created with gtmContext as inputs
    │  → schedule registered (M/Th 8am)
    │
    ▼
FIRST CYCLE (research-heavy)
    │  SENSE: web-search + perspectives (5 lenses) → pain signals
    │  ASSESS: perspectives (4 lenses) → strategy + 3 experiments
    │  GATE: structured review card → user approves strategy + experiments
    │  ACT: produces content drafts
    │  GATE: structured review card → user approves/edits/kills
    │  LAND: publishes content (Unipile/X API) + sends outreach (Unipile/AgentMail)
    │  LEARN: baseline established
    │  BRIEF: first cycle digest
    │
    ▼
CONTENT PUBLISHED AUTOMATICALLY
    │  LinkedIn → Unipile Posts API
    │  X → X API v2 (tweets + threads)
    │  Engagement data fed back next cycle via SENSE
    │
    ▼
AUTO-RESTART (continuous: true)
    │  learnOutputs + previousCycleRunId → next cycle inputs
    │  Process-scoped memories accumulate
    │  Strategy adapts based on experiment verdicts
    │
    ▼
CYCLE N+1...
    │  SENSE finds new signals (including engagement on previous posts)
    │  ASSESS reviews previous experiments: KILL / CONTINUE / GRADUATE
    │  Language bank grows in process memory
    │  Asset recommendations surface when data supports them
```

## Inputs

1. `processes/templates/gtm-pipeline.yaml` — Template to enhance with perspectives config
2. `processes/cycles/gtm-pipeline.yaml` — Ditto's own cycle (same enhancements)
3. `packages/web/lib/compositions/types.ts` — CompositionIntent type to extend
4. `packages/web/lib/compositions/index.ts` — Composition registry to add growth intent
5. `src/engine/feed-assembler.ts` — GTM-specific review card enrichment
6. `src/engine/surface-actions.ts` — Asset generation prompt handler
7. `src/engine/self-tools/cycle-tools.ts` — Add gtm-pipeline to cycle type map
8. `src/engine/channel.ts` — UnipileAdapter for LinkedIn DM outreach (Brief 133, already built)
9. `src/engine/channel-social.test.ts` — Existing Unipile tests (read for integration patterns)
10. `packages/core/src/content-blocks.ts` — No changes (existing block types sufficient)

## Constraints

- **No new DB tables** — plans are process instances, use existing processRuns/memories/schedules
- **No new block types** — compose from existing block types (metric, status_card, review_card, checklist, data, record, text, suggestion)
- **No new React components for blocks** — BlockRegistry already renders everything needed
- **No manual posting queue** — both LinkedIn (Unipile Posts API) and X (X API v2) publish automatically after GATE approval
- Perspectives run on SENSE and ASSESS (research phases) and content GATE (high-stakes)
- All content must pass through trust gate and outbound quality gate
- Content publishes automatically after GATE approval (Unipile for LinkedIn, X API for X)
- Asset recommendations are prompts, not auto-creation
- LinkedIn and X only for v1
- `cycleType` union extends cleanly (no migration needed — it's a text column with application-level validation)

## Acceptance Criteria

### Plan Creation (via conversation + cycle-tools)
- [ ] `activate_cycle` accepts `cycleType: "gtm-pipeline"` with structured `gtmContext`
- [ ] Multiple GTM pipeline instances can run concurrently (different audiences/channels)
- [ ] First cycle runs research-heavy SENSE+ASSESS with perspectives enabled
- [ ] Strategy proposal surfaces at GATE as structured review card
- [ ] User approves strategy → stored in gtmContext for subsequent cycles

### Growth Composition Intent
- [ ] "Growth" appears in sidebar navigation
- [ ] `composeGrowth()` returns blocks for all active GTM pipeline instances
- [ ] Each plan shows: metric (progress toward goal), status (current cycle phase), pending reviews, posting queue, experiments, asset recommendations, last brief
- [ ] Empty state suggests creating a plan via conversation
- [ ] All rendering uses existing block types — no new BlockRegistry entries

### Structured GATE Review
- [ ] Feed assembler enriches GTM pipeline GATE reviews with structured experiment presentation
- [ ] Each experiment shows: hook, target, hypothesis, kill criteria, confidence, full draft
- [ ] User can approve/edit/kill individual experiments (existing review card actions)

### Automated Publishing
- [ ] Approved content publishes automatically to LinkedIn via Unipile Posts API
- [ ] Approved content publishes automatically to X via X API v2 (including threads)
- [ ] Published posts recorded with `postId`, `postUrl`, `publishedAt` in step outputs
- [ ] Published posts feed into next cycle's SENSE as engagement tracking targets

### Perspectives
- [ ] SENSE step fires perspectives with 5 lenses (audience research)
- [ ] ASSESS step fires perspectives with 4 lenses (experiment design)
- [ ] GATE step fires perspectives with 2-3 lenses on content (high-stakes trigger)
- [ ] Lens Composer adapts lenses to audience/channel from gtmContext

### Cross-Cycle Learning
- [ ] Auto-restart passes learnOutputs to next cycle
- [ ] Process-scoped memories accumulate language bank entries
- [ ] Experiment verdicts (kill/continue/graduate) carry forward
- [ ] Strategy adapts (pillar emphasis, format mix) based on experiment evidence

## Output

1. Enhanced `gtm-pipeline` template and cycle YAML (perspectives config, structured gtmContext schema, Unipile + X API tool wiring)
2. `gtm-pipeline` added to cycleType union and cycle-tools map
3. `composeGrowth()` composition function + "Growth" sidebar intent
4. GTM-specific review card enrichment in feed assembler
5. `publishPost()` function + `XApiClient` for automated content publishing
6. `asset.generate` surface action (injects generation prompt into conversation)

## Sub-Briefs (build order)

| Brief | Title | Scope | Depends on |
|-------|-------|-------|-----------|
| 139 | GTM Cycle Type + Structured Inputs | cycleType union, gtmContext schema, cycle-tools mapping, YAML perspectives config, Unipile outreach wiring | This brief (138) |
| 140 | Growth Composition Intent | composeGrowth(), sidebar entry, lazy data fetch, GrowthPlanSummary API | 139 |
| 141 | Structured GATE + Automated Publishing | Feed assembler enrichment, Unipile Posts adapter, X API adapter, published content tracking, asset prompts | 139 (140 can be parallel) |

**Build sequence:** 139 first (engine foundation) → 140 + 141 in parallel (UI and publishing adapters are independent) → integration test.

## Reference Docs

- `docs/landscape.md` — needs update: add Unipile Posts API evaluation (feed posting) and X API v2 evaluation
- `docs/adrs/029-x-api-and-social-publishing.md` — created: X API v2 + Unipile Posts API adoption decision
- `docs/architecture.md` — checked, no drift found (process-as-primitive, trust gate, harness pipeline all apply as-is)

## Review Process

1. Architecture review: Does this truly use only existing primitives? No hidden new tables or types? (Dev Reviewer against architecture.md)
2. Composition review: Does composeGrowth() produce the right blocks from available data? (Dev Reviewer)
3. UX review: Is the growth dashboard informative enough? (Dev Designer)
4. Engine review: Does gtmContext flow correctly through auto-restart? Do memories accumulate properly? (Dev Reviewer)
