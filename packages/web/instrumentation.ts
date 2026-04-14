/**
 * Ditto — Next.js Instrumentation Hook
 *
 * Called once on server startup via Next.js `register()` export.
 * Auto-starts the nurture scheduler and runs schema sync.
 *
 * Provenance: Brief 086 (scheduler auto-start), Brief 089 (first-boot seed), Next.js instrumentation API.
 */

export async function register() {
  // Only run on the Node.js server runtime, not during build or edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[instrumentation] Ditto server starting...");

    // Load root .env for monorepo — Next.js only reads packages/web/.env by default
    try {
      const { config } = await import("dotenv");
      const path = await import("path");
      config({ path: path.resolve(process.cwd(), "../../.env") });
    } catch {
      // dotenv may not be installed — env vars may be set via platform (Railway, Fly, etc.)
    }

    try {
      // Ensure database schema is up to date
      const { ensureSchema } = await import("../../src/db");
      ensureSchema();
      console.log("[instrumentation] Schema sync complete.");
    } catch (error) {
      console.error("[instrumentation] Schema sync failed:", error);
      // Non-fatal — server can still start, schema may already be current
    }

    // Initialize LLM provider for front-door chat and other API routes
    try {
      const { initLlm } = await import("../../src/engine/llm");
      initLlm();
      console.log("[instrumentation] LLM provider initialized.");
    } catch (error) {
      console.error("[instrumentation] LLM init failed (chat will use mock fallback):", error);
    }

    // Sync process YAML definitions to DB so scheduler can register cron jobs.
    // Without this, cycles exist on disk but never execute (Brief 151 spike).
    try {
      const { loadAllProcesses, syncProcessesToDb } = await import("../../src/engine/process-loader");
      const { PROJECT_ROOT } = await import("../../src/paths");
      const path = await import("path");
      const processDir = path.join(PROJECT_ROOT, "processes");
      const templateDir = path.join(PROJECT_ROOT, "processes", "templates");
      const cycleDir = path.join(PROJECT_ROOT, "processes", "cycles");
      const definitions = loadAllProcesses(processDir, templateDir, cycleDir);
      await syncProcessesToDb(definitions);
      console.log(`[instrumentation] Synced ${definitions.length} process definitions to DB.`);
    } catch (error) {
      console.error("[instrumentation] Process sync failed:", error);
      // Non-fatal — processes may already be synced, or scheduler will start with existing DB state
    }

    try {
      // Auto-start the nurture scheduler
      const { start } = await import("../../src/engine/scheduler");
      await start();
      console.log("[instrumentation] Scheduler started.");
    } catch (error) {
      console.error("[instrumentation] Scheduler start failed:", error);
      // Non-fatal — scheduler can be started manually via CLI
    }

    try {
      // Auto-start the pulse — Alex's continuous operation loop (Brief 098a)
      // Scans for due delayed runs, unprocessed chains, and status composition
      const { startPulse } = await import("../../src/engine/pulse");
      startPulse();
      console.log("[instrumentation] Pulse started.");
    } catch (error) {
      console.error("[instrumentation] Pulse start failed:", error);
      // Non-fatal — pulse can be started manually
    }

    // Validate workspace auth configuration
    // When WORKSPACE_OWNER_EMAIL is set, auth is enforced — companion vars must be present.
    if (process.env.WORKSPACE_OWNER_EMAIL) {
      const missing: string[] = [];
      if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.NETWORK_BASE_URL) {
        missing.push("NEXT_PUBLIC_APP_URL (magic link emails need a domain)");
      }
      if (!process.env.SESSION_SECRET) {
        missing.push("SESSION_SECRET (HMAC signing falls back to guessable WORKSPACE_OWNER_EMAIL)");
      }
      if (!process.env.AGENTMAIL_API_KEY) {
        missing.push("AGENTMAIL_API_KEY (magic link emails cannot be sent)");
      }
      if (missing.length > 0) {
        console.warn(
          `[instrumentation] ⚠ Workspace auth is enabled (WORKSPACE_OWNER_EMAIL=${process.env.WORKSPACE_OWNER_EMAIL}) ` +
          `but ${missing.length} companion variable(s) are missing:\n` +
          missing.map((m) => `  - ${m}`).join("\n") +
          "\nSee .env.example for documentation.",
        );
      } else {
        console.log(`[instrumentation] Workspace auth configured for ${process.env.WORKSPACE_OWNER_EMAIL}`);
      }
    } else {
      console.log("[instrumentation] Workspace auth disabled (WORKSPACE_OWNER_EMAIL not set — local dev mode).");
    }

    // First-boot seed import (Brief 089)
    // If DITTO_NETWORK_URL is set and no self-scoped memories exist,
    // fetch and import the workspace seed from the Network Service.
    if (process.env.DITTO_NETWORK_URL) {
      try {
        const { isFirstBoot, fetchAndImportSeed } = await import(
          "../../src/engine/network-seed"
        );

        if (await isFirstBoot()) {
          console.log("[instrumentation] First boot detected — importing network seed...");
          const result = await fetchAndImportSeed();
          if (result) {
            console.log(
              `[instrumentation] Network seed imported: ${result.memoriesImported} memories, ${result.peopleImported} people, ${result.interactionsImported} interactions`,
            );
          }
        }
      } catch (error) {
        console.error("[instrumentation] Seed import failed:", error);
        // Non-fatal — workspace works standalone without seed
      }
    }
  }
}
